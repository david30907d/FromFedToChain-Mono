import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  toEpisodeResponse,
  decodeCursor,
  encodeCursor,
  findEpisodeBySourceUrl,
  listEpisodes,
  listEpisodesPaged,
  insertEpisode,
  listLanguageClassroomsByEpisodeId,
  listLanguageClassroomsByEpisodeIds,
  markEpisodeListened,
  updateEpisodeArticleContent,
  updateEpisodeStatus,
  upsertLanguageClassrooms,
} from './db.js';
import type { EpisodeRow, LanguageClassroomRow } from '../types.js';

vi.mock('../lib/env.js', () => ({
  getRequiredEnv: vi.fn((key: string) => {
    if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-key';
    throw new Error(`Unknown env: ${key}`);
  }),
}));

const {
  mockMaybeSingle,
  mockFrom,
  mockSelect,
  mockInsert: _mockInsert,
  mockUpdate,
  mockUpsert,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const eqChain = {
    eq: vi.fn(),
    maybeSingle: mockMaybeSingle,
  };
  eqChain.eq.mockReturnValue(eqChain);
  const mockOrder = vi.fn().mockReturnValue({
    returns: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
  const mockIn = vi.fn().mockReturnValue({
    order: mockOrder,
  });
  const mockSelect = vi.fn().mockReturnValue({
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
    eq: eqChain.eq,
    in: mockIn,
  });
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: mockMaybeSingle,
    }),
  });
  const mockUpsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      returns: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    }),
  });
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
  });
  return { mockMaybeSingle, mockSelect, mockInsert, mockUpdate, mockUpsert, mockFrom };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('toEpisodeResponse', () => {
  it('maps all row fields correctly', () => {
    const row: EpisodeRow = {
      id: 'uuid-123',
      title: 'Episode Title',
      source_url: 'https://example.com/article',
      language_code: 'zh-TW',
      hls_url: 'https://r2.example.com/episodes/uuid-123/playlist.m3u8',
      raw_text: 'raw text content',
      script: 'generated script',
      llm_model: 'mistralai/mistral-7b-instruct-v0.1',
      llm_thinking_model: 'anthropic/claude-3-opus',
      llm_provider: 'Cloudflare',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
      listened: true,
    };

    const response = toEpisodeResponse(row);
    expect(response.id).toBe('uuid-123');
    expect(response.title).toBe('Episode Title');
    expect(response.languageCode).toBe('zh-TW');
    expect(response.hlsUrl).toBe('https://r2.example.com/episodes/uuid-123/playlist.m3u8');
    expect(response.createdAt).toBe('2024-01-01T00:00:00Z');
    expect(response.listened).toBe(true);
    expect(response.script).toBe('generated script');
    expect(response.llmModel).toBe('mistralai/mistral-7b-instruct-v0.1');
    expect(response.llmThinkingModel).toBe('anthropic/claude-3-opus');
    expect(response.llmProvider).toBe('Cloudflare');
    expect(response.status).toBe('completed');
  });

  it('handles null optional fields', () => {
    const row: EpisodeRow = {
      id: 'uuid-456',
      title: 'Minimal Episode',
      source_url: 'https://example.com',
      language_code: 'zh-TW',
      hls_url: '',
      raw_text: null,
      script: null,
      llm_model: null,
      llm_thinking_model: null,
      llm_provider: null,
      status: 'pending',
      created_at: '2024-01-02T00:00:00Z',
      listened: false,
    };

    const response = toEpisodeResponse(row);
    expect(response.llmModel).toBeNull();
    expect(response.llmThinkingModel).toBeNull();
    expect(response.llmProvider).toBeNull();
    expect(response.listened).toBe(false);
    expect(response.script).toBeNull();
  });
});

describe('findEpisodeBySourceUrl', () => {
  it('returns episode when found', async () => {
    const episode: EpisodeRow = {
      id: '123',
      title: 'Test',
      source_url: 'https://example.com',
      language_code: 'zh-TW',
      hls_url: '',
      raw_text: null,
      script: null,
      llm_model: null,
      llm_thinking_model: null,
      llm_provider: null,
      status: 'pending',
      created_at: '',
      listened: false,
    };
    mockMaybeSingle.mockResolvedValue({ data: episode, error: null });

    const result = await findEpisodeBySourceUrl('https://example.com', 'zh-TW');
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-key',
      expect.objectContaining({
        db: { schema: 'from_fed_to_chain' },
      }),
    );
    expect(result).toEqual(episode);
  });

  it('returns null when not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await findEpisodeBySourceUrl('https://example.com/not-found', 'zh-TW');
    expect(result).toBeNull();
  });

  it('throws on database error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'db error' } });
    await expect(findEpisodeBySourceUrl('https://example.com', 'zh-TW')).rejects.toThrow(
      'db error',
    );
  });
});

describe('getSupabaseDbSchema', () => {
  it('uses custom schema from env when set', () => {
    vi.stubEnv('SUPABASE_DB_SCHEMA', 'custom_schema');
    vi.resetModules();
    import('./db.js').then(async (db) => {
      expect(db.listEpisodes).toBeDefined();
    });
    vi.unstubAllEnvs();
  });
});

describe('cursor helpers', () => {
  it('round-trips a cursor', () => {
    const cursor = {
      t: '2024-01-01T00:00:00.000Z',
      i: '00000000-0000-4000-8000-000000000001',
    };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rejects invalid cursor payloads', () => {
    expect(() => decodeCursor('garbage')).toThrow();
    expect(() =>
      decodeCursor(
        encodeCursor({
          t: 'not-a-date',
          i: '00000000-0000-4000-8000-000000000001',
        }),
      ),
    ).toThrow('bad cursor ts');
    expect(() =>
      decodeCursor(
        encodeCursor({
          t: '2024-01-01T00:00:00.000Z',
          i: 'not-a-uuid',
        }),
      ),
    ).toThrow('bad cursor id');
  });

  it('rejects cursors with wrong field types', () => {
    const invalidT = Buffer.from(
      JSON.stringify({ t: 123, i: '00000000-0000-4000-8000-000000000001' }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeCursor(invalidT)).toThrow('bad cursor shape');

    const invalidI = Buffer.from(
      JSON.stringify({ t: '2024-01-01T00:00:00.000Z', i: 456 }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeCursor(invalidI)).toThrow('bad cursor shape');

    const nullI = Buffer.from(
      JSON.stringify({ t: '2024-01-01T00:00:00.000Z', i: null }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeCursor(nullI)).toThrow('bad cursor shape');
  });

  it('rejects cursors with empty string t or i', () => {
    const emptyT = Buffer.from(
      JSON.stringify({ t: '', i: '00000000-0000-4000-8000-000000000001' }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeCursor(emptyT)).toThrow('bad cursor ts');

    const emptyI = Buffer.from(
      JSON.stringify({ t: '2024-01-01T00:00:00.000Z', i: '' }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeCursor(emptyI)).toThrow('bad cursor id');
  });
});

describe('listEpisodes', () => {
  it('returns episodes ordered by created_at desc', async () => {
    const episodes: EpisodeRow[] = [
      {
        id: '1',
        title: 'Latest',
        source_url: '',
        language_code: 'zh-TW',
        hls_url: '',
        raw_text: null,
        script: null,
        llm_model: null,
        llm_thinking_model: null,
        llm_provider: null,
        status: 'pending',
        created_at: '2024-01-02',
        listened: false,
      },
    ];
    vi.mocked(mockSelect).mockReturnValue({
      order: vi.fn().mockReturnValue({
        returns: vi.fn().mockResolvedValue({ data: episodes, error: null }),
      }),
      maybeSingle: mockMaybeSingle,
    });

    const result = await listEpisodes();
    expect(result).toEqual(episodes);
  });

  it('returns empty array on null data', async () => {
    vi.mocked(mockSelect).mockReturnValue({
      order: vi.fn().mockReturnValue({
        returns: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      maybeSingle: mockMaybeSingle,
    });

    const result = await listEpisodes();
    expect(result).toEqual([]);
  });

  it('throws on database error', async () => {
    vi.mocked(mockSelect).mockReturnValue({
      order: vi.fn().mockReturnValue({
        returns: vi.fn().mockResolvedValue({ data: null, error: { message: 'list error' } }),
      }),
      maybeSingle: mockMaybeSingle,
    });

    await expect(listEpisodes()).rejects.toThrow('list error');
  });
});

describe('listEpisodesPaged', () => {
  function row(index: number): EpisodeRow {
    const day = (25 - index).toString().padStart(2, '0');
    const idSuffix = (index + 1).toString().padStart(12, '0');
    return {
      id: `00000000-0000-4000-8000-${idSuffix}`,
      title: `Episode ${index + 1}`,
      source_url: `https://example.com/${index + 1}`,
      language_code: 'zh-TW',
      hls_url: '',
      raw_text: null,
      script: null,
      llm_model: null,
      llm_thinking_model: null,
      llm_provider: null,
      status: 'completed',
      created_at: `2024-01-${day}T00:00:00.000Z`,
      listened: false,
    };
  }

  function mockPagedQuery(data: EpisodeRow[]) {
    const returns = vi.fn().mockResolvedValue({ data, error: null });
    const or = vi.fn().mockReturnValue({ returns });
    const limit = vi.fn().mockReturnValue({ returns, or });
    const secondOrder = vi.fn().mockReturnValue({ limit });
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });

    vi.mocked(mockSelect).mockReturnValue({
      order: firstOrder,
      maybeSingle: mockMaybeSingle,
    });

    return { firstOrder, secondOrder, limit, or, returns };
  }

  it('returns nextCursor on page 1 and null on the final page', async () => {
    const seeded = Array.from({ length: 25 }, (_, index) => row(index));

    const page1Query = mockPagedQuery(seeded.slice(0, 21));
    const page1 = await listEpisodesPaged(20, null);

    expect(page1.rows).toEqual(seeded.slice(0, 20));
    expect(page1.nextCursor).toBe(
      encodeCursor({
        t: seeded[19].created_at,
        i: seeded[19].id,
      }),
    );
    expect(page1Query.limit).toHaveBeenCalledWith(21);

    const cursor = decodeCursor(page1.nextCursor!);
    const page2Query = mockPagedQuery(seeded.slice(20));
    const page2 = await listEpisodesPaged(20, cursor);

    expect(page2.rows).toEqual(seeded.slice(20));
    expect(page2.nextCursor).toBeNull();
    expect(page2Query.or).toHaveBeenCalledWith(
      `created_at.lt.${cursor.t},and(created_at.eq.${cursor.t},id.lt.${cursor.i})`,
    );
  });
});

describe('insertEpisode', () => {
  it('inserts episode and returns created row', async () => {
    const row: EpisodeRow = {
      id: 'new-id',
      title: 'New',
      source_url: 'https://example.com',
      language_code: 'zh-TW',
      hls_url: '',
      raw_text: 'text',
      script: '',
      llm_model: '',
      llm_thinking_model: null,
      llm_provider: '',
      status: 'scraped',
      created_at: '2024-01-01',
      listened: false,
    };
    mockMaybeSingle.mockResolvedValue({ data: row, error: null });

    const result = await insertEpisode({
      id: 'new-id',
      title: 'New',
      sourceUrl: 'https://example.com',
      languageCode: 'zh-TW',
      hlsUrl: '',
      rawText: 'text',
      script: '',
      llmModel: '',
      llmThinkingModel: null,
      llmProvider: '',
      status: 'scraped',
    });

    expect(result.id).toBe('new-id');
  });

  it('throws on database error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'insert error' } });

    await expect(
      insertEpisode({
        id: 'id',
        title: 'Title',
        sourceUrl: 'https://example.com',
        languageCode: 'zh-TW',
        hlsUrl: '',
        rawText: '',
        script: '',
        llmModel: '',
        llmThinkingModel: null,
        llmProvider: '',
        status: 'pending',
      }),
    ).rejects.toThrow('insert error');
  });
});

describe('markEpisodeListened', () => {
  it('updates listened to true and returns episode', async () => {
    const row: EpisodeRow = {
      id: '123',
      title: 'Test',
      source_url: '',
      language_code: 'zh-TW',
      hls_url: '',
      raw_text: null,
      script: null,
      llm_model: null,
      llm_thinking_model: null,
      llm_provider: null,
      status: 'completed',
      created_at: '',
      listened: true,
    };
    mockMaybeSingle.mockResolvedValue({ data: row, error: null });

    const result = await markEpisodeListened('123');
    expect(mockUpdate).toHaveBeenCalledWith({ listened: true });
    expect(result).toEqual(row);
  });

  it('returns null when episode not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await markEpisodeListened('not-found');
    expect(result).toBeNull();
  });

  it('throws on database error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'mark error' } });

    await expect(markEpisodeListened('123')).rejects.toThrow('mark error');
  });
});

describe('updateEpisodeArticleContent', () => {
  it('updates title and raw_text only', async () => {
    const row: EpisodeRow = {
      id: '123',
      title: '軟體更新',
      source_url: 'https://example.com/article',
      language_code: 'zh-TW',
      hls_url: 'https://cdn.example.com/article.m3u8',
      raw_text: '滑鼠和腳踏車市場',
      script: 'script',
      llm_model: 'model',
      llm_thinking_model: null,
      llm_provider: 'provider',
      status: 'completed',
      created_at: '2024-01-01T00:00:00.000Z',
      listened: false,
    };
    mockMaybeSingle.mockResolvedValue({ data: row, error: null });

    const result = await updateEpisodeArticleContent('123', {
      title: '軟體更新',
      text: '滑鼠和腳踏車市場',
    });

    expect(mockUpdate).toHaveBeenLastCalledWith({
      title: '軟體更新',
      raw_text: '滑鼠和腳踏車市場',
    });
    expect(result).toEqual(row);
  });

  it('throws on database error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'article update error' } });

    await expect(
      updateEpisodeArticleContent('123', {
        title: '軟體更新',
        text: '滑鼠和腳踏車市場',
      }),
    ).rejects.toThrow('article update error');
  });
});

describe('updateEpisodeStatus', () => {
  it('updates status only', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123', status: 'scraped' }, error: null });
    await updateEpisodeStatus('123', 'scraped');
    expect(mockFrom).toHaveBeenCalledWith('episodes');
  });

  it('updates with script field', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
    await updateEpisodeStatus('123', 'script_generated', { script: 'new script' });
  });

  it('updates with llmModel field', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
    await updateEpisodeStatus('123', 'script_generated', { llmModel: 'model-x' });
  });

  it('updates with llmThinkingModel field', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
    await updateEpisodeStatus('123', 'script_generated', { llmThinkingModel: 'think-model' });
  });

  it('updates with llmProvider field', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
    await updateEpisodeStatus('123', 'script_generated', { llmProvider: 'provider-x' });
  });

  it('updates with hlsUrl field', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
    await updateEpisodeStatus('123', 'completed', { hlsUrl: 'https://cdn.example.com/hls.m3u8' });
  });

  it('persists explicit empty string updates', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });

    await updateEpisodeStatus('123', 'scraped', {
      script: '',
      llmModel: '',
      llmThinkingModel: '',
      llmProvider: '',
      hlsUrl: '',
    });

    expect(mockUpdate).toHaveBeenLastCalledWith({
      status: 'scraped',
      script: '',
      llm_model: '',
      llm_thinking_model: '',
      llm_provider: '',
      hls_url: '',
    });
  });

  it('returns null when episode not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await updateEpisodeStatus('not-found', 'pending');
    expect(result).toBeNull();
  });

  it('throws on database error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'update error' } });
    await expect(updateEpisodeStatus('123', 'pending')).rejects.toThrow('update error');
  });
});
