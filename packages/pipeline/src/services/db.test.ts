import { describe, expect, it, vi } from 'vitest';
import {
  toEpisodeResponse,
  findEpisodeBySourceUrl,
  listEpisodes,
  insertEpisode,
  markEpisodeListened,
  updateEpisodeStatus,
} from './db.js';
import type { EpisodeRow } from '../types.js';

vi.mock('../lib/env.js', () => ({
  getRequiredEnv: vi.fn((key: string) => {
    if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-key';
    throw new Error(`Unknown env: ${key}`);
  }),
}));

const { mockMaybeSingle, mockFrom, mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockOrder = vi.fn().mockReturnValue({
    returns: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
  const mockSelect = vi.fn().mockReturnValue({
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
    eq: vi.fn().mockReturnValue({
      maybeSingle: mockMaybeSingle,
    }),
  });
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: mockMaybeSingle,
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
  });
  return { mockMaybeSingle, mockSelect, mockInsert, mockUpdate, mockFrom };
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

    const result = await findEpisodeBySourceUrl('https://example.com');
    expect(result).toEqual(episode);
  });

  it('returns null when not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await findEpisodeBySourceUrl('https://example.com/not-found');
    expect(result).toBeNull();
  });

  it('throws on database error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'db error' } });
    await expect(findEpisodeBySourceUrl('https://example.com')).rejects.toThrow('db error');
  });
});

describe('listEpisodes', () => {
  it('returns episodes ordered by created_at desc', async () => {
    const episodes: EpisodeRow[] = [
      {
        id: '1',
        title: 'Latest',
        source_url: '',
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

describe('insertEpisode', () => {
  it('inserts episode and returns created row', async () => {
    const row: EpisodeRow = {
      id: 'new-id',
      title: 'New',
      source_url: 'https://example.com',
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
        hlsUrl: '',
        rawText: '',
        script: '',
        llmModel: '',
        llmThinkingModel: null,
        llmProvider: '',
        status: 'pending',
      })
    ).rejects.toThrow('insert error');
  });
});

describe('markEpisodeListened', () => {
  it('updates listened to true and returns episode', async () => {
    const row: EpisodeRow = {
      id: '123',
      title: 'Test',
      source_url: '',
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
