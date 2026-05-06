create extension if not exists pgcrypto;
create schema if not exists from_fed_to_chain;

create table if not exists from_fed_to_chain.episodes (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  source_title text,
  created_at timestamptz not null default now(),
  listened boolean not null default false
);

create index if not exists idx_episodes_created_at
  on from_fed_to_chain.episodes (created_at desc);

create index if not exists idx_episodes_created_at_id
  on from_fed_to_chain.episodes (created_at desc, id desc);

create table if not exists from_fed_to_chain.episode_localizations (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references from_fed_to_chain.episodes(id) on delete cascade,
  language_code text not null default 'zh-Hant'
    check (btrim(language_code) <> ''),
  title text not null,
  hls_url text not null default '',
  raw_text text,
  script text,
  llm_model text,
  llm_thinking_model text,
  llm_provider text,
  tts_language_code text,
  tts_voice_name text,
  r2_prefix text,
  status text not null default 'pending'
    check (status in ('pending', 'scraped', 'script_generated', 'audio_generated', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, language_code)
);

create index if not exists idx_episode_localizations_language_created
  on from_fed_to_chain.episode_localizations (language_code, created_at desc, episode_id desc);

create table if not exists from_fed_to_chain.language_classrooms (
  id uuid primary key default gen_random_uuid(),
  episode_localization_id uuid not null
    references from_fed_to_chain.episode_localizations(id) on delete cascade,
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
  constraint language_classrooms_localization_target_language_key
    unique (episode_localization_id, target_language_code)
);

create index if not exists idx_language_classrooms_localization
  on from_fed_to_chain.language_classrooms (episode_localization_id);

alter table from_fed_to_chain.episodes enable row level security;
alter table from_fed_to_chain.episode_localizations enable row level security;
alter table from_fed_to_chain.language_classrooms enable row level security;

drop view if exists from_fed_to_chain.episodes_with_stats;
create view from_fed_to_chain.episodes_with_stats
with (security_invoker = true) as
select e.id,
       e.id as episode_id,
       el.id as localization_id,
       el.title,
       el.language_code,
       el.hls_url,
       el.script,
       el.llm_model,
       el.llm_thinking_model,
       el.llm_provider,
       el.status,
       e.created_at,
       e.listened,
       coalesce(l.like_count, 0)::int as like_count,
       coalesce(lc.language_classrooms, '[]'::jsonb) as language_classrooms
from from_fed_to_chain.episodes e
join from_fed_to_chain.episode_localizations el on el.episode_id = e.id
left join (
  select episode_id, count(*) as like_count
  from from_fed_to_chain.likes
  group by episode_id
) l on l.episode_id = e.id
left join (
  select episode_localization_id,
         jsonb_agg(
           jsonb_build_object(
             'sourceLanguageCode', source_language_code,
             'targetLanguageCode', target_language_code,
             'oneLiner', one_liner,
             'keywords', keywords
           )
           order by target_language_code
         ) as language_classrooms
  from from_fed_to_chain.language_classrooms
  group by episode_localization_id
) lc on lc.episode_localization_id = el.id
where el.status = 'completed'
  and el.hls_url <> '';

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
      and tablename = 'episode_localizations'
      and policyname = 'Service role can manage episode localizations'
  ) then
    create policy "Service role can manage episode localizations"
      on from_fed_to_chain.episode_localizations
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
grant all on from_fed_to_chain.episode_localizations to service_role;
grant all on from_fed_to_chain.language_classrooms to service_role;
