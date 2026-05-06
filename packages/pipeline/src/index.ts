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
  listLanguageClassroomsByEpisodeId,
  listLanguageClassroomsByEpisodeIds,
  listEpisodesPaged,
  markEpisodeListened,
  toEpisodeResponse,
  toEpisodeResponseWithClassrooms,
  updateEpisodeArticleContent,
  updateEpisodeStatus,
  decodeCursor,
  DEFAULT_LIMIT,
  upsertLanguageClassrooms,
  type Cursor,
} from './services/db.js';
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CLASSROOM_LANGUAGE_CODES,
  SUPPORTED_PRIMARY_LANGUAGE_CODES,
  type EpisodeRow,
  type LanguageClassroomLanguageCode,
  type LanguageClassroomRow,
} from './types.js';
import { generateLanguageClassroomsWithLLM, generateScriptWithLLM } from './services/llm.js';
import { scrapeArticle } from './services/scrape.js';
import { uploadHlsToR2 } from './services/storage.js';
import { generateHls } from './services/hls.js';
import { textToSpeech } from './services/tts.js';
import { convertArticleToZhTW } from './services/opencc.js';

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
  const languageCode = parsePrimaryLanguageCode(
    typeof body?.language === 'string' ? body.language : c.req.query('language'),
  );

  const existing = await step('findEpisodeBySourceUrl', () =>
    findEpisodeBySourceUrl(url, languageCode),
  );
  const status = existing?.status;

  if ((status === 'audio_generated' || status === 'completed') && existing) {
    const classrooms = await ensureLanguageClassrooms(existing, languageCode);
    return c.json(toEpisodeResponseWithClassrooms(existing, classrooms));
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
          languageCode,
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
    const hlsUrl = await step('uploadHlsToR2', () => uploadHlsToR2(files, id, languageCode));
    latest = await step('updateEpisodeStatus:completed', () =>
      updateEpisodeStatus(id, 'completed', {
        hlsUrl,
      }),
    );
    if (latest && languageCode === DEFAULT_LANGUAGE_CODE) {
      latest = await convertCompletedArticleToZhTW(latest);
    }
  }

  if (!latest) {
    throw new HTTPException(500, { message: 'Failed to retrieve episode' });
  }

  const classrooms = await ensureLanguageClassrooms(latest, languageCode);
  return c.json(toEpisodeResponseWithClassrooms(latest, classrooms), 201);
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
  const classroomMap = await listLanguageClassroomsByEpisodeIds(rows.map((row) => row.id));
  return c.json({
    items: rows.map((row) => toEpisodeResponseWithClassrooms(row, classroomMap.get(row.id) ?? [])),
    nextCursor,
  });
});

app.post('/episodes/:id/listened', async (c) => {
  const episode = await markEpisodeListened(c.req.param('id'));

  if (!episode) {
    throw new HTTPException(404, { message: 'Episode not found' });
  }

  const classrooms = await listLanguageClassroomsByEpisodeId(episode.id);
  return c.json(toEpisodeResponseWithClassrooms(episode, classrooms));
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
  const languageCode = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LANGUAGE_CODE;

  if (!(SUPPORTED_PRIMARY_LANGUAGE_CODES as readonly string[]).includes(languageCode)) {
    throw new HTTPException(400, { message: `Unsupported language: ${languageCode}` });
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

async function convertCompletedArticleToZhTW(episode: EpisodeRow): Promise<EpisodeRow> {
  try {
    const converted = convertArticleToZhTW({
      title: episode.title,
      text: episode.raw_text ?? '',
    });
    return (
      (await step('updateEpisodeArticleContent:zhTW', () =>
        updateEpisodeArticleContent(episode.id, converted),
      )) ?? episode
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[/ingest] zh-TW article conversion failed:', {
      episodeId: episode.id,
      message: err.message,
      stack: err.stack,
      cause: err.cause,
    });
    return episode;
  }
}

async function ensureLanguageClassrooms(
  episode: EpisodeRow,
  sourceLanguageCode: LanguageClassroomLanguageCode,
): Promise<LanguageClassroomRow[]> {
  let existing: LanguageClassroomRow[] = [];

  try {
    existing =
      (await step('listLanguageClassroomsByEpisodeId', () =>
        listLanguageClassroomsByEpisodeId(episode.id),
      )) ?? [];

    const existingTargets = new Set(existing.map((row) => row.target_language_code));
    const missingTargets = getClassroomTargetLanguageCodes(sourceLanguageCode).filter(
      (targetLanguageCode) => !existingTargets.has(targetLanguageCode),
    );

    if (missingTargets.length === 0) {
      return orderLanguageClassrooms(existing, sourceLanguageCode);
    }

    const generated = await step('generateLanguageClassrooms', () =>
      generateLanguageClassroomsWithLLM({
        title: episode.title,
        articleText: episode.raw_text ?? '',
        script: episode.script ?? '',
        sourceLanguageCode,
        targetLanguageCodes: missingTargets,
      }),
    );

    const persisted = await step('upsertLanguageClassrooms', () =>
      upsertLanguageClassrooms(
        generated.lessons.map((lesson) => ({
          id: randomUUID(),
          episodeId: episode.id,
          sourceLanguageCode: lesson.sourceLanguageCode,
          targetLanguageCode: lesson.targetLanguageCode,
          oneLiner: lesson.oneLiner,
          keywords: lesson.keywords,
          llmModel: generated.model,
          llmThinkingModel: generated.thinkingModel,
          llmProvider: generated.provider,
        })),
      ),
    );

    const persistedTargets = new Set(persisted.map((row) => row.target_language_code));
    const retainedExisting = existing.filter((row) => !persistedTargets.has(row.target_language_code));

    return orderLanguageClassrooms([...retainedExisting, ...persisted], sourceLanguageCode);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[/ingest] language classroom generation failed:', {
      episodeId: episode.id,
      sourceLanguageCode,
      message: err.message,
      stack: err.stack,
      cause: err.cause,
    });
    return orderLanguageClassrooms(existing, sourceLanguageCode);
  }
}

function getClassroomTargetLanguageCodes(
  sourceLanguageCode: LanguageClassroomLanguageCode,
): LanguageClassroomLanguageCode[] {
  return LANGUAGE_CLASSROOM_LANGUAGE_CODES.filter(
    (languageCode) => languageCode !== sourceLanguageCode,
  );
}

function orderLanguageClassrooms(
  rows: LanguageClassroomRow[],
  sourceLanguageCode: LanguageClassroomLanguageCode,
): LanguageClassroomRow[] {
  const order = new Map(
    getClassroomTargetLanguageCodes(sourceLanguageCode).map((languageCode, index) => [
      languageCode,
      index,
    ]),
  );

  return [...rows].sort(
    (a, b) =>
      (order.get(a.target_language_code as LanguageClassroomLanguageCode) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.target_language_code as LanguageClassroomLanguageCode) ?? Number.MAX_SAFE_INTEGER),
  );
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
