import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeRow, LanguageClassroomRow } from './types.js';

const {
  mockDecodeCursor,
  mockFindEpisodeBySourceUrl,
  mockGenerateHls,
  mockGenerateLanguageClassroomsWithLLM,
  mockGenerateScriptWithLLM,
  mockInsertEpisode,
  mockListLanguageClassroomsByEpisodeId,
  mockListLanguageClassroomsByEpisodeIds,
  mockListEpisodesPaged,
  mockMarkEpisodeListened,
  mockScrapeArticle,
  mockServe,
  mockTextToSpeech,
  mockUpdateEpisodeArticleContent,
  mockUpdateEpisodeStatus,
  mockUpsertLanguageClassrooms,
  mockUploadHlsToR2,
  mockConvertArticleToZhTW,
} = vi.hoisted(() => ({
  mockDecodeCursor: vi.fn(),
  mockFindEpisodeBySourceUrl: vi.fn(),
  mockGenerateHls: vi.fn(),
  mockGenerateLanguageClassroomsWithLLM: vi.fn(),
  mockGenerateScriptWithLLM: vi.fn(),
  mockInsertEpisode: vi.fn(),
  mockListLanguageClassroomsByEpisodeId: vi.fn(),
  mockListLanguageClassroomsByEpisodeIds: vi.fn(),
  mockListEpisodesPaged: vi.fn(),
  mockMarkEpisodeListened: vi.fn(),
  mockScrapeArticle: vi.fn(),
  mockServe: vi.fn(),
  mockTextToSpeech: vi.fn(),
  mockUpdateEpisodeArticleContent: vi.fn(),
  mockUpdateEpisodeStatus: vi.fn(),
  mockUpsertLanguageClassrooms: vi.fn(),
  mockUploadHlsToR2: vi.fn(),
  mockConvertArticleToZhTW: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
  serve: mockServe,
}));

vi.mock('./services/db.js', () => ({
  DEFAULT_LIMIT: 20,
  decodeCursor: mockDecodeCursor,
  findEpisodeBySourceUrl: mockFindEpisodeBySourceUrl,
  insertEpisode: mockInsertEpisode,
  listLanguageClassroomsByEpisodeId: mockListLanguageClassroomsByEpisodeId,
  listLanguageClassroomsByEpisodeIds: mockListLanguageClassroomsByEpisodeIds,
  listEpisodesPaged: mockListEpisodesPaged,
  markEpisodeListened: mockMarkEpisodeListened,
  toEpisodeResponse: (row: EpisodeRow) => episodeResponse(row, []),
  toEpisodeResponseWithClassrooms: (
    row: EpisodeRow,
    languageClassrooms: LanguageClassroomRow[],
  ) => episodeResponse(row, languageClassrooms),
  upsertLanguageClassrooms: mockUpsertLanguageClassrooms,
  updateEpisodeArticleContent: mockUpdateEpisodeArticleContent,
  updateEpisodeStatus: mockUpdateEpisodeStatus,
}));

function episodeResponse(row: EpisodeRow, languageClassrooms: LanguageClassroomRow[]) {
  return {
    id: row.id,
    title: row.title,
    languageCode: row.language_code,
    hlsUrl: row.hls_url,
    createdAt: row.created_at,
    listened: row.listened,
    script: row.script,
    llmModel: row.llm_model,
    llmThinkingModel: row.llm_thinking_model,
    llmProvider: row.llm_provider,
    status: row.status,
    languageClassrooms: languageClassrooms.map((classroom) => ({
      sourceLanguageCode: classroom.source_language_code,
      targetLanguageCode: classroom.target_language_code,
      oneLiner: classroom.one_liner,
      keywords: classroom.keywords,
    })),
  };
}

vi.mock('./services/llm.js', () => ({
  generateLanguageClassroomsWithLLM: mockGenerateLanguageClassroomsWithLLM,
  generateScriptWithLLM: mockGenerateScriptWithLLM,
}));

vi.mock('./services/scrape.js', () => ({
  scrapeArticle: mockScrapeArticle,
}));

vi.mock('./services/storage.js', () => ({
  uploadHlsToR2: mockUploadHlsToR2,
}));

vi.mock('./services/hls.js', () => ({
  generateHls: mockGenerateHls,
}));

vi.mock('./services/tts.js', () => ({
  textToSpeech: mockTextToSpeech,
}));

vi.mock('./services/opencc.js', () => ({
  convertArticleToZhTW: mockConvertArticleToZhTW,
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
    language_code: 'zh-TW',
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
    mockListLanguageClassroomsByEpisodeId.mockResolvedValue([]);
    mockGenerateLanguageClassroomsWithLLM.mockResolvedValue({
      lessons: [],
      model: 'test-model',
      thinkingModel: null,
      provider: 'test-provider',
    });
    mockUpsertLanguageClassrooms.mockResolvedValue([]);
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
    expect(mockFindEpisodeBySourceUrl).toHaveBeenCalledWith('https://example.com/article', 'zh-TW');
    expect(body).toEqual({
      id: completedEpisode.id,
      title: completedEpisode.title,
      languageCode: completedEpisode.language_code,
      hlsUrl: completedEpisode.hls_url,
      createdAt: completedEpisode.created_at,
      listened: completedEpisode.listened,
      script: completedEpisode.script,
      llmModel: completedEpisode.llm_model,
      llmThinkingModel: completedEpisode.llm_thinking_model,
      llmProvider: completedEpisode.llm_provider,
      status: completedEpisode.status,
      languageClassrooms: [],
    });
  });
});

describe('POST /ingest zh-TW conversion', () => {
  const id = '00000000-0000-4000-8000-000000000003';
  const url = 'https://example.com/article';
  const hlsUrl = 'https://cdn.example.com/episodes/article/playlist.m3u8';
  const completedEpisode: EpisodeRow = {
    id,
    title: '软件更新',
    source_url: url,
    language_code: 'zh-TW',
    hls_url: hlsUrl,
    raw_text: '鼠标和自行车市场',
    script: 'Generated script',
    llm_model: 'test-model',
    llm_thinking_model: null,
    llm_provider: 'test-provider',
    status: 'completed',
    created_at: '2024-01-03T00:00:00.000Z',
    listened: false,
  };
  const convertedArticle = {
    title: '軟體更新',
    text: '滑鼠和腳踏車市場',
  };
  const convertedEpisode: EpisodeRow = {
    ...completedEpisode,
    title: convertedArticle.title,
    raw_text: convertedArticle.text,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('INGEST_ADMIN_TOKEN', 'secret-token');
    mockFindEpisodeBySourceUrl.mockResolvedValue(null);
    mockScrapeArticle.mockResolvedValue({
      title: '软件更新',
      text: '鼠标和自行车市场',
    });
    mockInsertEpisode.mockResolvedValue({
      ...completedEpisode,
      hls_url: '',
      script: '',
      llm_model: '',
      llm_provider: '',
      status: 'scraped',
    });
    mockGenerateScriptWithLLM.mockResolvedValue({
      script: completedEpisode.script,
      model: completedEpisode.llm_model,
      thinkingModel: completedEpisode.llm_thinking_model,
      provider: completedEpisode.llm_provider,
    });
    mockUpdateEpisodeStatus.mockImplementation((_episodeId: string, status: string) => {
      if (status === 'script_generated') {
        return Promise.resolve({
          ...completedEpisode,
          hls_url: '',
          status: 'script_generated',
        });
      }
      if (status === 'completed') {
        return Promise.resolve(completedEpisode);
      }
      return Promise.resolve(null);
    });
    mockTextToSpeech.mockResolvedValue(Buffer.from('audio'));
    mockGenerateHls.mockResolvedValue({
      files: [
        {
          name: 'playlist.m3u8',
          data: Buffer.from('hls'),
          contentType: 'application/vnd.apple.mpegurl',
        },
      ],
      playlistKey: 'playlist.m3u8',
    });
    mockUploadHlsToR2.mockResolvedValue(hlsUrl);
    mockConvertArticleToZhTW.mockReturnValue(convertedArticle);
    mockUpdateEpisodeArticleContent.mockResolvedValue(convertedEpisode);
    mockListLanguageClassroomsByEpisodeId.mockResolvedValue([]);
    mockGenerateLanguageClassroomsWithLLM.mockResolvedValue({
      lessons: [],
      model: 'test-model',
      thinkingModel: null,
      provider: 'test-provider',
    });
    mockUpsertLanguageClassrooms.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('converts completed article title and raw text to zh-TW after HLS upload', async () => {
    const response = await app.request('/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockConvertArticleToZhTW).toHaveBeenCalledWith({
      title: completedEpisode.title,
      text: completedEpisode.raw_text,
    });
    expect(mockUpdateEpisodeArticleContent).toHaveBeenCalledWith(id, convertedArticle);
    expect(mockUploadHlsToR2).toHaveBeenCalledWith(expect.any(Array), id, 'zh-TW');
    expect(mockUpdateEpisodeArticleContent.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockUploadHlsToR2.mock.invocationCallOrder[0],
    );
    expect(mockUpdateEpisodeArticleContent.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockUpdateEpisodeStatus.mock.invocationCallOrder[1],
    );
    expect(body).toEqual({
      id,
      title: convertedEpisode.title,
      languageCode: convertedEpisode.language_code,
      hlsUrl,
      createdAt: convertedEpisode.created_at,
      listened: convertedEpisode.listened,
      script: convertedEpisode.script,
      llmModel: convertedEpisode.llm_model,
      llmThinkingModel: convertedEpisode.llm_thinking_model,
      llmProvider: convertedEpisode.llm_provider,
      status: convertedEpisode.status,
      languageClassrooms: [],
    });
  });

  it('returns completed audio data when zh-TW conversion persistence fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUpdateEpisodeArticleContent.mockRejectedValue(new Error('article update failed'));

    const response = await app.request('/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(consoleError).toHaveBeenCalledWith(
      '[/ingest] zh-TW article conversion failed:',
      expect.objectContaining({
        episodeId: id,
        message: '[step:updateEpisodeArticleContent:zhTW] article update failed',
      }),
    );
    expect(body).toEqual({
      id,
      title: completedEpisode.title,
      languageCode: completedEpisode.language_code,
      hlsUrl,
      createdAt: completedEpisode.created_at,
      listened: completedEpisode.listened,
      script: completedEpisode.script,
      llmModel: completedEpisode.llm_model,
      llmThinkingModel: completedEpisode.llm_thinking_model,
      llmProvider: completedEpisode.llm_provider,
      status: completedEpisode.status,
      languageClassrooms: [],
    });

    consoleError.mockRestore();
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
      language_code: 'zh-TW',
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
    mockListLanguageClassroomsByEpisodeIds.mockResolvedValue(new Map());

    const response = await app.request('/episodes?limit=5');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockListEpisodesPaged).toHaveBeenCalledWith(5, null, 'zh-TW');
    expect(body).toEqual({
      items: [
        {
          id: row.id,
          title: row.title,
          languageCode: row.language_code,
          hlsUrl: row.hls_url,
          createdAt: row.created_at,
          listened: row.listened,
          script: row.script,
          llmModel: row.llm_model,
          llmThinkingModel: row.llm_thinking_model,
          llmProvider: row.llm_provider,
          status: row.status,
          languageClassrooms: [],
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
