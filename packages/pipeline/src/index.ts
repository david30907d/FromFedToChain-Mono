import dotenv from 'dotenv';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });
import { serve } from '@hono/node-server';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { getPort } from './lib/env.js';
import {
  findEpisodeBySourceUrl,
  insertEpisode,
  listEpisodes,
  markEpisodeListened,
  toEpisodeResponse,
  updateEpisodeStatus,
} from './services/db.js';
import { generateScript } from './services/generateScript.js';
import { scrapeArticle } from './services/scrape.js';
import { uploadToR2 } from './services/storage.js';
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

app.get('/health', (c) => {
  return c.json({ ok: true });
});

app.post('/ingest', async (c) => {
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
  let existingScript: string | null = existing?.script ?? null;
  let existingModel: string | null = existing?.llm_model ?? null;
  let existingThinkingModel: string | null = existing?.llm_thinking_model ?? null;
  let existingProvider: string | null = existing?.llm_provider ?? null;
  let existingRawText: string | null = existing?.raw_text ?? null;

  if (!existing || status === 'pending') {
    article = await step('scrapeArticle', () => scrapeArticle(url));
    existingRawText = article.text;
    if (!existing) {
      await step('insertEpisode', () =>
        insertEpisode({
          id,
          title: article.title,
          sourceUrl: url,
          audioUrl: '',
          rawText: article.text,
          script: '',
          llmModel: '',
          llmThinkingModel: null,
          llmProvider: '',
          status: 'scraped',
        })
      );
    } else {
      await step('updateEpisodeStatus:scraped', () =>
        updateEpisodeStatus(id, 'scraped', {
          audioUrl: '',
          script: '',
        })
      );
    }
  } else {
    article = { title: existing.title, text: existingRawText || '' };
  }

  if (status === 'scraped' || !status || status === 'pending') {
    const { script, model, thinkingModel, provider } = await step('generateScript', () =>
      generateScript(article)
    );
    existingScript = script;
    existingModel = model;
    existingThinkingModel = thinkingModel;
    existingProvider = provider;
    await step('updateEpisodeStatus:script_generated', () =>
      updateEpisodeStatus(id, 'script_generated', {
        script,
        llmModel: model,
        llmThinkingModel: thinkingModel,
        llmProvider: provider,
      })
    );
  }

  if (status !== 'audio_generated' && status !== 'completed') {
    const audio = await step('textToSpeech', () => textToSpeech(existingScript || ''));
    const audioUrl = await step('uploadToR2', () =>
      uploadToR2(audio, `episodes/${id}.mp3`)
    );
    await step('updateEpisodeStatus:completed', () =>
      updateEpisodeStatus(id, 'completed', {
        audioUrl,
      })
    );
  }

  const episode = await step('findEpisodeBySourceUrl:final', () =>
    findEpisodeBySourceUrl(url)
  );
  if (!episode) {
    throw new HTTPException(500, { message: 'Failed to retrieve episode' });
  }

  return c.json(toEpisodeResponse(episode), 201);
});

app.get('/episodes', async (c) => {
  const episodes = await listEpisodes();
  return c.json(episodes.map(toEpisodeResponse));
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
    500
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

const port = getPort();

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Pipeline API listening on http://localhost:${info.port}`);
  }
);

export default app;