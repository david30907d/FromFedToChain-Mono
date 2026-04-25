import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRequiredEnv } from '../lib/env.js';
import type { EpisodeResponse, EpisodeRow, NewEpisode } from '../types.js';

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
    audioUrl: row.audio_url,
    createdAt: row.created_at,
    listened: row.listened,
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

export async function insertEpisode(episode: NewEpisode): Promise<EpisodeRow> {
  const { data, error } = await getSupabase()
    .from('episodes')
    .insert({
      id: episode.id,
      title: episode.title,
      source_url: episode.sourceUrl,
      audio_url: episode.audioUrl,
      raw_text: episode.rawText,
      script: episode.script,
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
