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
  DEFAULT_LIMIT,
  decodeCursor,
  findEpisodeBySourceUrl,
  findEpisodeLocalizationByEpisodeId,
  insertEpisode,
  insertEpisodeLocalization,
  listEpisodesPaged,
  listLanguageClassroomsByLocalizationId,
  listLanguageClassroomsByLocalizationIds,
  markEpisodeListened,
  toEpisodeResponse,
  toEpisodeResponseFromLocalization,
  updateEpisodeLocalizationArticleContent,
  updateEpisodeLocalizationStatus,
  upsertLanguageClassrooms,
  type Cursor,
} from './services/db.js';
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CLASSROOM_LANGUAGE_CODES,
  LEGACY_LANGUAGE_ALIASES,
  SUPPORTED_PRIMARY_LANGUAGE_CODES,
  type Article,
  type EpisodeLocalizationRow,
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

  let episode = await step('findEpisodeBySourceUrl', () => findEpisodeBySourceUrl(url));
  let localization: EpisodeLocalizationRow | null = null;
  if (episode) {
    const episodeId = episode.id;
    localization = await step('findEpisodeLocalizationByEpisodeId', () =>
      findEpisodeLocalizationByEpisodeId(episodeId, languageCode),
    );
  }

  if (
    episode &&
    localization &&
    (localization.status === 'audio_generated' || localization.status === 'completed')
  ) {
    const classrooms = await ensureLanguageClassrooms(localization, languageCode);
    return c.json(toEpisodeResponseFromLocalization(episode, localization, classrooms));
  }

  const needsScrape = !episode || !localization || localization.status === 'pending';
  let article: Article = localization
    ? {
        title: localization.title,
        text: localization.raw_text ?? '',
      }
    : {
        title: '',
        text: '',
      };

  if (needsScrape) {
    const scrapedArticle = await step('scrapeArticle', () => scrapeArticle(url));
    article = normalizeArticleForLanguage(scrapedArticle, languageCode);

    if (!episode) {
      episode = await step('insertEpisode', () =>
        insertEpisode({
          id: randomUUID(),
          sourceUrl: url,
          sourceTitle: scrapedArticle.title,
        }),
      );
    }

    if (!localization) {
      localization = await step('insertEpisodeLocalization', () =>
        insertEpisodeLocalization({
          id: randomUUID(),
          episodeId: episode!.id,
          languageCode,
          title: article.title,
          hlsUrl: '',
          rawText: article.text,
          script: '',
          llmModel: '',
          llmThinkingModel: null,
          llmProvider: '',
          ttsLanguageCode: null,
          ttsVoiceName: null,
          r2Prefix: null,
          status: 'scraped',
        }),
      );
    } else {
      localization = await step('updateEpisodeLocalizationStatus:scraped', async () => {
        await updateEpisodeLocalizationArticleContent(localization!.id, article);
        return updateEpisodeLocalizationStatus(localization!.id, 'scraped', {
          hlsUrl: '',
          script: '',
          r2Prefix: null,
          ttsLanguageCode: null,
          ttsVoiceName: null,
        });
      });
    }
  }

  if (!episode || !localization) {
    throw new HTTPException(500, { message: 'Failed to create episode localization' });
  }

  if (
    localization.status === 'scraped' ||
    localization.status === 'pending' ||
    !localization.status
  ) {
    const generated = await step('generateScript', () =>
      generateScriptWithLLM(article.title, article.text),
    );
    localization = await step('updateEpisodeLocalizationStatus:script_generated', () =>
      updateEpisodeLocalizationStatus(localization!.id, 'script_generated', {
        script: generated.script,
        llmModel: generated.model,
        llmThinkingModel: generated.thinkingModel,
        llmProvider: generated.provider,
      }),
    );
  }

  if (!localization) {
    throw new HTTPException(500, { message: 'Failed to retrieve episode localization' });
  }

  if (localization.status !== 'audio_generated' && localization.status !== 'completed') {
    const script = localization.script ?? '';
    const audio = await step('textToSpeech', () => textToSpeech(script));
    const { files } = await step('generateHls', () => generateHls(audio));
    const uploaded = await step('uploadHlsToR2', () =>
      uploadHlsToR2(files, episode!.id, languageCode),
    );
    const ttsMetadata = getTtsMetadataForLanguage(languageCode);
    localization = await step('updateEpisodeLocalizationStatus:completed', () =>
      updateEpisodeLocalizationStatus(localization!.id, 'completed', {
        hlsUrl: uploaded.hlsUrl,
        r2Prefix: uploaded.r2Prefix,
        ttsLanguageCode: ttsMetadata.languageCode,
        ttsVoiceName: ttsMetadata.voiceName,
      }),
    );
  }

  const classrooms = await ensureLanguageClassrooms(
    localization as EpisodeLocalizationRow,
    languageCode,
  );
  return c.json(
    toEpisodeResponseFromLocalization(episode, localization as EpisodeLocalizationRow, classrooms),
    201,
  );
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

function normalizeArticleForLanguage(article: Article, languageCode: string): Article {
  if (languageCode !== DEFAULT_LANGUAGE_CODE) {
    return article;
  }

  return convertArticleToZhTW(article);
}

function getTtsMetadataForLanguage(languageCode: string): {
  languageCode: string;
  voiceName: string;
} {
  if (languageCode !== DEFAULT_LANGUAGE_CODE) {
    return {
      languageCode,
      voiceName: '',
    };
  }

  return {
    languageCode: process.env.GOOGLE_TTS_LANGUAGE_CODE || 'cmn-TW',
    voiceName: process.env.GOOGLE_TTS_VOICE_NAME || 'cmn-TW-Wavenet-A',
  };
}

async function ensureLanguageClassrooms(
  localization: EpisodeLocalizationRow,
  sourceLanguageCode: LanguageClassroomLanguageCode,
): Promise<LanguageClassroomRow[]> {
  let existing: LanguageClassroomRow[] = [];

  try {
    existing = await step('listLanguageClassroomsByLocalizationId', () =>
      listLanguageClassroomsByLocalizationId(localization.id),
    );

    const existingTargets = new Set(existing.map((row) => row.target_language_code));
    const missingTargets = getClassroomTargetLanguageCodes(sourceLanguageCode).filter(
      (targetLanguageCode) => !existingTargets.has(targetLanguageCode),
    );

    if (missingTargets.length === 0) {
      return orderLanguageClassrooms(existing, sourceLanguageCode);
    }

    const generated = await step('generateLanguageClassrooms', () =>
      generateLanguageClassroomsWithLLM({
        title: localization.title,
        articleText: localization.raw_text ?? '',
        script: localization.script ?? '',
        sourceLanguageCode,
        targetLanguageCodes: missingTargets,
      }),
    );

    const persisted = await step('upsertLanguageClassrooms', () =>
      upsertLanguageClassrooms(
        generated.lessons.map((lesson) => ({
          id: randomUUID(),
          episodeLocalizationId: localization.id,
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
    const retainedExisting = existing.filter(
      (row) => !persistedTargets.has(row.target_language_code),
    );

    return orderLanguageClassrooms([...retainedExisting, ...persisted], sourceLanguageCode);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[/ingest] language classroom generation failed:', {
      episodeLocalizationId: localization.id,
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
      (order.get(a.target_language_code as LanguageClassroomLanguageCode) ??
        Number.MAX_SAFE_INTEGER) -
      (order.get(b.target_language_code as LanguageClassroomLanguageCode) ??
        Number.MAX_SAFE_INTEGER),
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
