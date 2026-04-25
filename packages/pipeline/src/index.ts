import 'dotenv/config';
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
} from './services/db.js';
import { generateScript } from './services/generateScript.js';
import { scrapeArticle } from './services/scrape.js';
import { uploadToR2 } from './services/storage.js';
import { textToSpeech } from './services/tts.js';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => {
  return c.json({ ok: true });
});

app.post('/ingest', async (c) => {
  const body = await c.req.json().catch(() => null);
  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
  const url = parseInputUrl(rawUrl);

  const existing = await findEpisodeBySourceUrl(url);
  if (existing) {
    return c.json(toEpisodeResponse(existing));
  }

  const article = await scrapeArticle(url);
  const script = await generateScript(article);
  const audio = await textToSpeech(script);
  const id = randomUUID();
  const audioUrl = await uploadToR2(audio, `episodes/${id}.mp3`);

  const episode = await insertEpisode({
    id,
    title: article.title,
    sourceUrl: url,
    audioUrl,
    rawText: article.text,
    script,
  });

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

  console.error(error);
  return c.json({ error: 'Internal server error' }, 500);
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
