import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeRow } from './types.js';

const {
  mockDecodeCursor,
  mockFindEpisodeBySourceUrl,
  mockListEpisodesPaged,
  mockMarkEpisodeListened,
  mockServe,
} = vi.hoisted(() => ({
  mockDecodeCursor: vi.fn(),
  mockFindEpisodeBySourceUrl: vi.fn(),
  mockListEpisodesPaged: vi.fn(),
  mockMarkEpisodeListened: vi.fn(),
  mockServe: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
  serve: mockServe,
}));

vi.mock('./services/db.js', () => ({
  DEFAULT_LIMIT: 20,
  decodeCursor: mockDecodeCursor,
  findEpisodeBySourceUrl: mockFindEpisodeBySourceUrl,
  insertEpisode: vi.fn(),
  listEpisodesPaged: mockListEpisodesPaged,
  markEpisodeListened: mockMarkEpisodeListened,
  toEpisodeResponse: (row: EpisodeRow) => ({
    id: row.id,
    title: row.title,
    hlsUrl: row.hls_url,
    createdAt: row.created_at,
    listened: row.listened,
    script: row.script,
    llmModel: row.llm_model,
    llmThinkingModel: row.llm_thinking_model,
    llmProvider: row.llm_provider,
    status: row.status,
  }),
  updateEpisodeStatus: vi.fn(),
}));

vi.mock('./services/llm.js', () => ({
  generateScriptWithLLM: vi.fn(),
}));

vi.mock('./services/scrape.js', () => ({
  scrapeArticle: vi.fn(),
}));

vi.mock('./services/storage.js', () => ({
  uploadHlsToR2: vi.fn(),
}));

vi.mock('./services/hls.js', () => ({
  generateHls: vi.fn(),
}));

vi.mock('./services/tts.js', () => ({
  textToSpeech: vi.fn(),
}));

const app = (await import('./index.js')).default;

describe('health checks', () => {
  it.each(['/', '/health'])('returns ok for GET %s', async (path) => {
    const response = await app.request(path);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});

describe('POST /ingest authorization', () => {
  const completedEpisode: EpisodeRow = {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Ready Episode',
    source_url: 'https://example.com/article',
    hls_url: 'https://cdn.example.com/ready.m3u8',
    raw_text: 'Article text',
    script: 'Episode script',
    llm_model: 'test-model',
    llm_thinking_model: null,
    llm_provider: 'test-provider',
    status: 'completed',
    created_at: '2024-01-02T00:00:00.000Z',
    listened: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('INGEST_ADMIN_TOKEN', 'secret-token');
    mockFindEpisodeBySourceUrl.mockResolvedValue(completedEpisode);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'Bearer wrong-token'],
  ])('returns 401 for %s admin authorization', async (_label, authorization) => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (authorization) {
      headers.authorization = authorization;
    }

    const response = await app.request('/ingest', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: 'https://example.com/article' }),
    });

    expect(response.status).toBe(401);
    expect(mockFindEpisodeBySourceUrl).not.toHaveBeenCalled();
  });

  it('accepts valid admin authorization', async () => {
    const response = await app.request('/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://example.com/article' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFindEpisodeBySourceUrl).toHaveBeenCalledWith('https://example.com/article');
    expect(body).toEqual({
      id: completedEpisode.id,
      title: completedEpisode.title,
      hlsUrl: completedEpisode.hls_url,
      createdAt: completedEpisode.created_at,
      listened: completedEpisode.listened,
      script: completedEpisode.script,
      llmModel: completedEpisode.llm_model,
      llmThinkingModel: completedEpisode.llm_thinking_model,
      llmProvider: completedEpisode.llm_provider,
      status: completedEpisode.status,
    });
  });
});

describe('GET /episodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecodeCursor.mockImplementation((raw: string) => ({
      t: '2024-01-01T00:00:00.000Z',
      i: raw,
    }));
    mockListEpisodesPaged.mockResolvedValue({ rows: [], nextCursor: null });
  });

  it('returns a paginated response', async () => {
    const row: EpisodeRow = {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Latest',
      source_url: 'https://example.com/latest',
      hls_url: 'https://cdn.example.com/latest.m3u8',
      raw_text: null,
      script: null,
      llm_model: null,
      llm_thinking_model: null,
      llm_provider: null,
      status: 'completed',
      created_at: '2024-01-01T00:00:00.000Z',
      listened: false,
    };
    mockListEpisodesPaged.mockResolvedValue({
      rows: [row],
      nextCursor: 'next-cursor',
    });

    const response = await app.request('/episodes?limit=5');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockListEpisodesPaged).toHaveBeenCalledWith(5, null);
    expect(body).toEqual({
      items: [
        {
          id: row.id,
          title: row.title,
          hlsUrl: row.hls_url,
          createdAt: row.created_at,
          listened: row.listened,
          script: row.script,
          llmModel: row.llm_model,
          llmThinkingModel: row.llm_thinking_model,
          llmProvider: row.llm_provider,
          status: row.status,
        },
      ],
      nextCursor: 'next-cursor',
    });
  });

  it('returns 400 for an invalid limit', async () => {
    const response = await app.request('/episodes?limit=abc');

    expect(response.status).toBe(400);
    expect(mockListEpisodesPaged).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid cursor', async () => {
    mockDecodeCursor.mockImplementation(() => {
      throw new Error('bad cursor');
    });

    const response = await app.request('/episodes?cursor=garbage');

    expect(response.status).toBe(400);
    expect(mockListEpisodesPaged).not.toHaveBeenCalled();
  });
});
