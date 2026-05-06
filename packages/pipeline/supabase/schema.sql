create extension if not exists pgcrypto;
create schema if not exists from_fed_to_chain;

create table if not exists from_fed_to_chain.episodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null,
  language_code text not null default 'zh-TW'
    check (btrim(language_code) <> ''),
  hls_url text not null default '',
  raw_text text,
  script text,
  llm_model text,
  llm_thinking_model text,
  llm_provider text,
  status text not null default 'pending'
    check (status in ('pending', 'scraped', 'script_generated', 'audio_generated', 'completed')),
  created_at timestamptz not null default now(),
  listened boolean not null default false
);

create unique index if not exists episodes_source_url_language_code_key
  on from_fed_to_chain.episodes (source_url, language_code);

create index if not exists idx_episodes_created_at
  on from_fed_to_chain.episodes (created_at desc);

-- Composite index for cursor pagination - supports tuple comparison
-- (created_at, id) used by listEpisodesPaged() in src/services/db.ts.
create index if not exists idx_episodes_created_at_id
  on from_fed_to_chain.episodes (created_at desc, id desc);

create index if not exists idx_episodes_language_created_at_id
  on from_fed_to_chain.episodes (language_code, created_at desc, id desc);

create table if not exists from_fed_to_chain.language_classrooms (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references from_fed_to_chain.episodes(id) on delete cascade,
  source_language_code text not null,
  target_language_code text not null,
  one_liner text not null,
  keywords jsonb not null default '[]'::jsonb,
  llm_model text,
  llm_thinking_model text,
  llm_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint language_classrooms_language_codes_not_empty
    check (btrim(source_language_code) <> '' and btrim(target_language_code) <> ''),
  constraint language_classrooms_keywords_is_array
    check (jsonb_typeof(keywords) = 'array'),
  constraint language_classrooms_episode_target_language_key
    unique (episode_id, target_language_code)
);

create index if not exists idx_language_classrooms_episode
  on from_fed_to_chain.language_classrooms (episode_id);

create index if not exists idx_language_classrooms_target_language
  on from_fed_to_chain.language_classrooms (target_language_code);

alter table from_fed_to_chain.episodes enable row level security;
alter table from_fed_to_chain.language_classrooms enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'from_fed_to_chain'
      and tablename = 'episodes'
      and policyname = 'Service role can manage episodes'
  ) then
    create policy "Service role can manage episodes"
      on from_fed_to_chain.episodes
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'from_fed_to_chain'
      and tablename = 'language_classrooms'
      and policyname = 'Service role can manage language classrooms'
  ) then
    create policy "Service role can manage language classrooms"
      on from_fed_to_chain.language_classrooms
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

grant usage on schema from_fed_to_chain to service_role;
grant all on from_fed_to_chain.episodes to service_role;
grant all on from_fed_to_chain.language_classrooms to service_role;
