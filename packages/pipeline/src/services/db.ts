import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRequiredEnv } from '../lib/env.js';
import type { EpisodeResponse, EpisodeRow, EpisodeStatus, NewEpisode } from '../types.js';

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  client ??= createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return client;
}

export function toEpisodeResponse(row: EpisodeRow): EpisodeResponse {
  return {
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
  };
}

export async function findEpisodeBySourceUrl(url: string): Promise<EpisodeRow | null> {
  const { data, error } = await getSupabase()
    .from('episodes')
    .select('*')
    .eq('source_url', url)
    .maybeSingle<EpisodeRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function listEpisodes(): Promise<EpisodeRow[]> {
  const { data, error } = await getSupabase()
    .from('episodes')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<EpisodeRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Cursor pagination
// ---------------------------------------------------------------------------

export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

export type Cursor = { t: string; i: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  const obj = JSON.parse(
    Buffer.from(raw, 'base64url').toString('utf8'),
  ) as Cursor;
  if (typeof obj?.t !== 'string' || typeof obj?.i !== 'string') {
    throw new Error('bad cursor shape');
  }
  if (Number.isNaN(Date.parse(obj.t))) throw new Error('bad cursor ts');
  if (!/^[0-9a-f-]{36}$/i.test(obj.i)) throw new Error('bad cursor id');
  return obj;
}

export async function listEpisodesPaged(
  limit: number,
  cursor: Cursor | null,
): Promise<{ rows: EpisodeRow[]; nextCursor: string | null }> {
  const lim = Math.min(Math.max(limit | 0, 1), MAX_LIMIT);

  let q = getSupabase()
    .from('episodes')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(lim + 1); // +1 to detect hasMore

  if (cursor) {
    // PostgREST tuple-comparison: created_at < t  OR  (created_at = t AND id < i)
    q = q.or(
      `created_at.lt.${cursor.t},and(created_at.eq.${cursor.t},id.lt.${cursor.i})`,
    );
  }

  const { data, error } = await q.returns<EpisodeRow[]>();
  if (error) throw error;

  const all = data ?? [];
  const hasMore = all.length > lim;
  const rows = hasMore ? all.slice(0, lim) : all;
  const last = hasMore ? rows[rows.length - 1] : null;

  return {
    rows,
    nextCursor: last ? encodeCursor({ t: last.created_at, i: last.id }) : null,
  };
}

export async function insertEpisode(episode: NewEpisode): Promise<EpisodeRow> {
  const { data, error } = await getSupabase()
    .from('episodes')
    .insert({
      id: episode.id,
      title: episode.title,
      source_url: episode.sourceUrl,
      hls_url: episode.hlsUrl,
      raw_text: episode.rawText,
      script: episode.script,
      llm_model: episode.llmModel,
      llm_thinking_model: episode.llmThinkingModel,
      llm_provider: episode.llmProvider,
      status: episode.status,
    })
    .select('*')
    .single<EpisodeRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function markEpisodeListened(id: string): Promise<EpisodeRow | null> {
  const { data, error } = await getSupabase()
    .from('episodes')
    .update({ listened: true })
    .eq('id', id)
    .select('*')
    .maybeSingle<EpisodeRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateEpisodeStatus(
  id: string,
  status: EpisodeStatus,
  updates?: Partial<Pick<NewEpisode, 'script' | 'llmModel' | 'llmThinkingModel' | 'llmProvider' | 'hlsUrl'>>
): Promise<EpisodeRow | null> {
  const setFields: Record<string, unknown> = { status };
  if (updates?.script !== undefined) setFields.script = updates.script;
  if (updates?.llmModel !== undefined) setFields.llm_model = updates.llmModel;
  if (updates?.llmThinkingModel !== undefined) setFields.llm_thinking_model = updates.llmThinkingModel;
  if (updates?.llmProvider !== undefined) setFields.llm_provider = updates.llmProvider;
  if (updates?.hlsUrl !== undefined) setFields.hls_url = updates.hlsUrl;

  const { data, error } = await getSupabase()
    .from('episodes')
    .update(setFields)
    .eq('id', id)
    .select('*')
    .maybeSingle<EpisodeRow>();

  if (error) {
    throw error;
  }

  return data;
}
