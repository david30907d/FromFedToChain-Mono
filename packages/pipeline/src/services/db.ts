import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRequiredEnv } from '../lib/env.js';
import type {
  Article,
  EpisodeResponse,
  EpisodeRow,
  EpisodeStatus,
  LanguageClassroomKeyword,
  LanguageClassroomLesson,
  LanguageClassroomRow,
  NewEpisode,
  NewLanguageClassroom,
} from '../types.js';

type PipelineSupabaseClient = SupabaseClient<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

let client: PipelineSupabaseClient | null = null;

const DEFAULT_SUPABASE_DB_SCHEMA = 'from_fed_to_chain';

function getSupabaseDbSchema(): string {
  return process.env.SUPABASE_DB_SCHEMA?.trim() || DEFAULT_SUPABASE_DB_SCHEMA;
}

function getSupabase(): PipelineSupabaseClient {
  client ??= createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      db: {
        schema: getSupabaseDbSchema(),
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return client;
}

export function toEpisodeResponse(row: EpisodeRow): EpisodeResponse {
  return toEpisodeResponseWithClassrooms(row, []);
}

export function toEpisodeResponseWithClassrooms(
  row: EpisodeRow,
  languageClassrooms: LanguageClassroomRow[] | LanguageClassroomLesson[],
): EpisodeResponse {
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
    languageClassrooms: languageClassrooms.map(toLanguageClassroomLesson),
  };
}

export function toLanguageClassroomLesson(
  row: LanguageClassroomRow | LanguageClassroomLesson,
): LanguageClassroomLesson {
  if ('targetLanguageCode' in row) {
    return row;
  }

  return {
    sourceLanguageCode: row.source_language_code,
    targetLanguageCode: row.target_language_code,
    oneLiner: row.one_liner,
    keywords: normalizeKeywords(row.keywords),
  };
}

export async function findEpisodeBySourceUrl(
  url: string,
  languageCode: string,
): Promise<EpisodeRow | null> {
  const { data, error } = await getSupabase()
    .from('episodes')
    .select('*')
    .eq('source_url', url)
    .eq('language_code', languageCode)
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
  const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
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
  languageCode?: string,
): Promise<{ rows: EpisodeRow[]; nextCursor: string | null }> {
  const lim = Math.min(Math.max(limit | 0, 1), MAX_LIMIT);

  let q = getSupabase()
    .from('episodes')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(lim + 1); // +1 to detect hasMore

  if (languageCode) {
    q = q.eq('language_code', languageCode);
  }

  if (cursor) {
    // PostgREST tuple-comparison: created_at < t  OR  (created_at = t AND id < i)
    q = q.or(`created_at.lt.${cursor.t},and(created_at.eq.${cursor.t},id.lt.${cursor.i})`);
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
      language_code: episode.languageCode,
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

export async function listLanguageClassroomsByEpisodeId(
  episodeId: string,
): Promise<LanguageClassroomRow[]> {
  const { data, error } = await getSupabase()
    .from('language_classrooms')
    .select('*')
    .eq('episode_id', episodeId)
    .order('target_language_code', { ascending: true })
    .returns<LanguageClassroomRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(normalizeLanguageClassroomRow);
}

export async function listLanguageClassroomsByEpisodeIds(
  episodeIds: string[],
): Promise<Map<string, LanguageClassroomRow[]>> {
  const map = new Map<string, LanguageClassroomRow[]>();
  if (episodeIds.length === 0) return map;

  const { data, error } = await getSupabase()
    .from('language_classrooms')
    .select('*')
    .in('episode_id', episodeIds)
    .order('target_language_code', { ascending: true })
    .returns<LanguageClassroomRow[]>();

  if (error) {
    throw error;
  }

  for (const row of (data ?? []).map(normalizeLanguageClassroomRow)) {
    const rows = map.get(row.episode_id) ?? [];
    rows.push(row);
    map.set(row.episode_id, rows);
  }

  return map;
}

export async function upsertLanguageClassrooms(
  lessons: NewLanguageClassroom[],
): Promise<LanguageClassroomRow[]> {
  if (lessons.length === 0) return [];

  const now = new Date().toISOString();
  const payload = lessons.map((lesson) => ({
    episode_id: lesson.episodeId,
    source_language_code: lesson.sourceLanguageCode,
    target_language_code: lesson.targetLanguageCode,
    one_liner: lesson.oneLiner,
    keywords: lesson.keywords,
    llm_model: lesson.llmModel,
    llm_thinking_model: lesson.llmThinkingModel,
    llm_provider: lesson.llmProvider,
    updated_at: now,
  }));

  const { data, error } = await getSupabase()
    .from('language_classrooms')
    .upsert(payload, { onConflict: 'episode_id,target_language_code' })
    .select('*')
    .returns<LanguageClassroomRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(normalizeLanguageClassroomRow);
}

async function updateEpisodeFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<EpisodeRow | null> {
  const { data, error } = await getSupabase()
    .from('episodes')
    .update(fields)
    .eq('id', id)
    .select('*')
    .maybeSingle<EpisodeRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function markEpisodeListened(id: string): Promise<EpisodeRow | null> {
  return updateEpisodeFields(id, { listened: true });
}

export async function updateEpisodeArticleContent(
  id: string,
  article: Article,
): Promise<EpisodeRow | null> {
  return updateEpisodeFields(id, {
    title: article.title,
    raw_text: article.text,
  });
}

export async function updateEpisodeStatus(
  id: string,
  status: EpisodeStatus,
  updates?: Partial<
    Pick<NewEpisode, 'script' | 'llmModel' | 'llmThinkingModel' | 'llmProvider' | 'hlsUrl'>
  >,
): Promise<EpisodeRow | null> {
  const setFields: Record<string, unknown> = { status };
  if (updates?.script !== undefined) setFields.script = updates.script;
  if (updates?.llmModel !== undefined) setFields.llm_model = updates.llmModel;
  if (updates?.llmThinkingModel !== undefined)
    setFields.llm_thinking_model = updates.llmThinkingModel;
  if (updates?.llmProvider !== undefined) setFields.llm_provider = updates.llmProvider;
  if (updates?.hlsUrl !== undefined) setFields.hls_url = updates.hlsUrl;

  return updateEpisodeFields(id, setFields);
}

function normalizeLanguageClassroomRow(row: LanguageClassroomRow): LanguageClassroomRow {
  return {
    ...row,
    keywords: normalizeKeywords(row.keywords),
  };
}

function normalizeKeywords(value: unknown): LanguageClassroomKeyword[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const keyword = raw as Record<string, unknown>;
      const term = readString(keyword.term);
      const meaning = readString(keyword.meaning);
      if (!term || !meaning) return null;
      return {
        term,
        reading: readNullableString(keyword.reading),
        meaning,
        note: readNullableString(keyword.note),
      };
    })
    .filter((keyword): keyword is LanguageClassroomKeyword => keyword !== null);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNullableString(value: unknown): string | null {
  const text = readString(value);
  return text || null;
}
