export interface Article {
  title: string;
  text: string;
}

export interface EpisodeRow {
  id: string;
  title: string;
  source_url: string;
  audio_url: string;
  raw_text: string | null;
  script: string | null;
  llm_model: string | null;
  llm_thinking_model: string | null;
  created_at: string;
  listened: boolean;
}

export interface EpisodeResponse {
  id: string;
  title: string;
  audioUrl: string;
  createdAt: string;
  listened: boolean;
  llmModel: string | null;
  llmThinkingModel: string | null;
}

export interface NewEpisode {
  id: string;
  title: string;
  sourceUrl: string;
  audioUrl: string;
  rawText: string;
  script: string;
  llmModel: string;
  llmThinkingModel: string | null;
}