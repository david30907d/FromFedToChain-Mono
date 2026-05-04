export interface Article {
  title: string;
  text: string;
}

export type EpisodeStatus =
  | 'pending'
  | 'scraped'
  | 'script_generated'
  | 'audio_generated'
  | 'completed';

export interface EpisodeRow {
  id: string;
  title: string;
  source_url: string;
  hls_url: string;
  raw_text: string | null;
  script: string | null;
  llm_model: string | null;
  llm_thinking_model: string | null;
  llm_provider: string | null;
  status: EpisodeStatus;
  created_at: string;
  listened: boolean;
}

export interface EpisodeResponse {
  id: string;
  title: string;
  hlsUrl: string;
  createdAt: string;
  listened: boolean;
  script: string | null;
  llmModel: string | null;
  llmThinkingModel: string | null;
  llmProvider: string | null;
  status: EpisodeStatus;
}

export interface NewEpisode {
  id: string;
  title: string;
  sourceUrl: string;
  hlsUrl: string;
  rawText: string;
  script: string;
  llmModel: string;
  llmThinkingModel: string | null;
  llmProvider: string;
  status: EpisodeStatus;
}
