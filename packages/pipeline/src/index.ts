import dotenv from 'dotenv';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });
import { serve } from '@hono/node-server';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { getPort } from './lib/env.js';
import {
  findEpisodeBySourceUrl,
  insertEpisode,
  listEpisodesPaged,
  markEpisodeListened,
  toEpisodeResponse,
  updateEpisodeStatus,
  decodeCursor,
  DEFAULT_LIMIT,
  type Cursor,
} from './services/db.js';
import type { EpisodeRow } from './types.js';
import { generateScriptWithLLM } from './services/llm.js';
import { scrapeArticle } from './services/scrape.js';
import { uploadHlsToR2 } from './services/storage.js';
import { generateHls } from './services/hls.js';
import { textToSpeech } from './services/tts.js';

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const wrapped = new Error(`[step:${name}] ${err.message}`, { cause: err });
    const meta = (err as { $metadata?: unknown }).$metadata;
    if (meta !== undefined) {
      (wrapped as { $metadata?: unknown }).$metadata = meta;
    }
    throw wrapped;
  }
}

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

  const existing = await step('findEpisodeBySourceUrl', () => findEpisodeBySourceUrl(url));
  const status = existing?.status;

  if ((status === 'audio_generated' || status === 'completed') && existing) {
    return c.json(toEpisodeResponse(existing));
  }

  const id = existing?.id || randomUUID();
  let article: { title: string; text: string };
  let script: string = existing?.script ?? '';
  let latest: EpisodeRow | null = existing ?? null;

  if (!existing || status === 'pending') {
    article = await step('scrapeArticle', () => scrapeArticle(url));
    if (!existing) {
      latest = await step('insertEpisode', () =>
        insertEpisode({
          id,
          title: article.title,
          sourceUrl: url,
          hlsUrl: '',
          rawText: article.text,
          script: '',
          llmModel: '',
          llmThinkingModel: null,
          llmProvider: '',
          status: 'scraped',
        }),
      );
    } else {
      latest = await step('updateEpisodeStatus:scraped', () =>
        updateEpisodeStatus(id, 'scraped', {
          hlsUrl: '',
          script: '',
        }),
      );
    }
  } else {
    article = { title: existing.title, text: existing.raw_text ?? '' };
  }

  if (status === 'scraped' || !status || status === 'pending') {
    const generated = await step('generateScript', () =>
      generateScriptWithLLM(article.title, article.text),
    );
    script = generated.script;
    latest = await step('updateEpisodeStatus:script_generated', () =>
      updateEpisodeStatus(id, 'script_generated', {
        script: generated.script,
        llmModel: generated.model,
        llmThinkingModel: generated.thinkingModel,
        llmProvider: generated.provider,
      }),
    );
  }

  if (status !== 'audio_generated' && status !== 'completed') {
    const audio = await step('textToSpeech', () => textToSpeech(script));
    const { files } = await step('generateHls', () => generateHls(audio));
    const hlsUrl = await step('uploadHlsToR2', () => uploadHlsToR2(files, id));
    latest = await step('updateEpisodeStatus:completed', () =>
      updateEpisodeStatus(id, 'completed', {
        hlsUrl,
      }),
    );
  }

  if (!latest) {
    throw new HTTPException(500, { message: 'Failed to retrieve episode' });
  }

  return c.json(toEpisodeResponse(latest), 201);
});

app.get('/episodes', async (c) => {
  const limitRaw = c.req.query('limit');
  const cursorRaw = c.req.query('cursor');

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

  const { rows, nextCursor } = await listEpisodesPaged(limit, cursor);
  return c.json({ items: rows.map(toEpisodeResponse), nextCursor });
});

app.post('/episodes/:id/listened', async (c) => {
  const episode = await markEpisodeListened(c.req.param('id'));

  if (!episode) {
    throw new HTTPException(404, { message: 'Episode not found' });
  }

  return c.json(toEpisodeResponse(episode));
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
