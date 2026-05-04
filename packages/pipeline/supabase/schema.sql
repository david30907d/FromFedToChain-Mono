create extension if not exists pgcrypto;
create schema if not exists from_fed_to_chain;

create table if not exists from_fed_to_chain.episodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null unique,
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

create index if not exists idx_episodes_created_at
  on from_fed_to_chain.episodes (created_at desc);

-- Composite index for cursor pagination - supports tuple comparison
-- (created_at, id) used by listEpisodesPaged() in src/services/db.ts.
create index if not exists idx_episodes_created_at_id
  on from_fed_to_chain.episodes (created_at desc, id desc);

alter table from_fed_to_chain.episodes enable row level security;

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

grant usage on schema from_fed_to_chain to service_role;
grant all on from_fed_to_chain.episodes to service_role;
