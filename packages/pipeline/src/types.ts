export interface Article {
  title: string;
  text: string;
}

export interface Database {
  public: DatabasePublic;
}

export interface DatabasePublic {
  Tables: {
    episodes: {
      Row: EpisodeRow;
      Insert: Omit<NewEpisode, 'id'> & { id?: string };
      Update: Partial<NewEpisode>;
    };
    language_classrooms: {
      Row: LanguageClassroomRow;
      Insert: Omit<NewLanguageClassroom, 'id'> & { id?: string };
      Update: Partial<NewLanguageClassroom>;
    };
  };
}

export const DEFAULT_LANGUAGE_CODE = 'zh-TW';
export const SUPPORTED_PRIMARY_LANGUAGE_CODES = [DEFAULT_LANGUAGE_CODE] as const;
export const LANGUAGE_CLASSROOM_LANGUAGE_CODES = ['zh-TW', 'ja-JP', 'en-US'] as const;

export type SupportedPrimaryLanguageCode = (typeof SUPPORTED_PRIMARY_LANGUAGE_CODES)[number];
export type LanguageClassroomLanguageCode = (typeof LANGUAGE_CLASSROOM_LANGUAGE_CODES)[number];

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
  language_code: string;
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

export interface LanguageClassroomKeyword {
  term: string;
  reading: string | null;
  meaning: string;
  note: string | null;
}

export interface LanguageClassroomLesson {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  oneLiner: string;
  keywords: LanguageClassroomKeyword[];
}

export interface LanguageClassroomRow {
  id: string;
  episode_id: string;
  source_language_code: string;
  target_language_code: string;
  one_liner: string;
  keywords: LanguageClassroomKeyword[];
  llm_model: string | null;
  llm_thinking_model: string | null;
  llm_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeResponse {
  id: string;
  title: string;
  languageCode: string;
  hlsUrl: string;
  createdAt: string;
  listened: boolean;
  script: string | null;
  llmModel: string | null;
  llmThinkingModel: string | null;
  llmProvider: string | null;
  status: EpisodeStatus;
  languageClassrooms: LanguageClassroomLesson[];
}

export interface NewEpisode {
  id: string;
  title: string;
  sourceUrl: string;
  languageCode: string;
  hlsUrl: string;
  rawText: string;
  script: string;
  llmModel: string;
  llmThinkingModel: string | null;
  llmProvider: string;
  status: EpisodeStatus;
}

export interface NewLanguageClassroom {
  id: string;
  episodeId: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  oneLiner: string;
  keywords: LanguageClassroomKeyword[];
  llmModel: string;
  llmThinkingModel: string | null;
  llmProvider: string;
}
