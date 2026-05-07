import dotenv from 'dotenv';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });
import { serve } from '@hono/node-server';
import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { getPort } from './lib/env.js';
import {
  DEFAULT_LIMIT,
  decodeCursor,
  findEpisodeLocalizationByEpisodeId,
  listEpisodesPaged,
  listLanguageClassroomsByLocalizationId,
  listLanguageClassroomsByLocalizationIds,
  markEpisodeListened,
  toEpisodeResponse,
  toEpisodeResponseFromLocalization,
  type Cursor,
} from './services/db.js';
import {
  DEFAULT_LANGUAGE_CODE,
  LEGACY_LANGUAGE_ALIASES,
  SUPPORTED_PRIMARY_LANGUAGE_CODES,
  type LanguageClassroomLanguageCode,
  type LanguageClassroomRow,
} from './types.js';
import { performIngest } from './services/ingest.js';

const app = new Hono();

app.use('*', cors());

function healthResponse(c: Context) {
  return c.json({ ok: true });
}

app.get('/', healthResponse);
app.get('/health', healthResponse);

app.post('/ingest', async (c) => {
  requireAdminAuthorization(c.req.header('authorization'));

  const body = await c.req.json().catch(() => null);
  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
  const url = parseInputUrl(rawUrl);
  const languageCode = parsePrimaryLanguageCode(
    typeof body?.language === 'string' ? body.language : c.req.query('language'),
  );

  const result = await performIngest(url, languageCode);
  return c.json(result.episode, result.statusCode);
});

app.get('/episodes', async (c) => {
  const limitRaw = c.req.query('limit');
  const cursorRaw = c.req.query('cursor');
  const languageCode = parsePrimaryLanguageCode(c.req.query('language'));

  const limit = limitRaw === undefined ? DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new HTTPException(400, { message: 'invalid limit' });
  }

  let cursor: Cursor | null = null;
  if (cursorRaw) {
    try {
      cursor = decodeCursor(cursorRaw);
    } catch {
      throw new HTTPException(400, { message: 'invalid cursor' });
    }
  }

  const { rows, nextCursor } = await listEpisodesPaged(limit, cursor, languageCode);
  const classroomMap = await listLanguageClassroomsByLocalizationIds(
    rows.map((row) => row.localization_id),
  );
  return c.json({
    items: rows.map((row) => {
      const classrooms =
        classroomMap.get(row.localization_id) ??
        (row.language_classrooms as LanguageClassroomRow[] | undefined);
      return toEpisodeResponse(row, classrooms);
    }),
    nextCursor,
  });
});

app.post('/episodes/:id/listened', async (c) => {
  const languageCode = parsePrimaryLanguageCode(c.req.query('language'));
  const episode = await markEpisodeListened(c.req.param('id'));

  if (!episode) {
    throw new HTTPException(404, { message: 'Episode not found' });
  }

  const localization = await findEpisodeLocalizationByEpisodeId(episode.id, languageCode);
  if (!localization) {
    throw new HTTPException(404, { message: 'Episode localization not found' });
  }

  const classrooms = await listLanguageClassroomsByLocalizationId(localization.id);
  return c.json(toEpisodeResponseFromLocalization(episode, localization, classrooms));
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  const err = error as Error & { $metadata?: unknown; cause?: unknown };
  console.error('[/ingest] unhandled error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    awsMetadata: err.$metadata,
    cause: err.cause,
  });

  const isDev = process.env.NODE_ENV !== 'production';
  return c.json(
    {
      error: 'Internal server error',
      ...(isDev && {
        name: err.name,
        message: err.message,
        stack: err.stack,
        awsMetadata: err.$metadata,
        cause:
          err.cause instanceof Error
            ? { name: err.cause.name, message: err.cause.message, stack: err.cause.stack }
            : err.cause,
      }),
    },
    500,
  );
});

function parseInputUrl(value: string): string {
  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('URL must use http or https');
    }

    return url.toString();
  } catch {
    throw new HTTPException(400, { message: 'Invalid url' });
  }
}

function parsePrimaryLanguageCode(value: unknown): LanguageClassroomLanguageCode {
  const rawLanguageCode =
    typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LANGUAGE_CODE;
  const languageCode =
    LEGACY_LANGUAGE_ALIASES[rawLanguageCode as keyof typeof LEGACY_LANGUAGE_ALIASES] ??
    rawLanguageCode;

  if (!(SUPPORTED_PRIMARY_LANGUAGE_CODES as readonly string[]).includes(languageCode)) {
    throw new HTTPException(400, { message: `Unsupported language: ${rawLanguageCode}` });
  }

  return languageCode as LanguageClassroomLanguageCode;
}

function requireAdminAuthorization(authorization: string | undefined): void {
  const expectedToken = process.env.INGEST_ADMIN_TOKEN;
  if (!expectedToken) {
    throw new HTTPException(500, { message: 'INGEST_ADMIN_TOKEN is not configured' });
  }

  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match || !safeTokenEqual(match[1], expectedToken)) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
}

function safeTokenEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

const port = getPort();

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Pipeline API listening on http://localhost:${info.port}`);
  },
);

export default app;
