create extension if not exists pgcrypto;

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null unique,
  audio_url text not null,
  raw_text text,
  script text,
  created_at timestamptz not null default now(),
  listened boolean not null default false
);

create index if not exists idx_episodes_created_at
  on public.episodes (created_at desc);

alter table public.episodes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'episodes'
      and policyname = 'Service role can manage episodes'
  ) then
    create policy "Service role can manage episodes"
      on public.episodes
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
