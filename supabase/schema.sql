-- ─────────────────────────────────────────────────────────────────────────────
-- AI Club Website — Robust Production Supabase Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. club_info (singleton row)
create table if not exists public.club_info (
  id                    text        primary key default 'club_main',
  club_name             text        not null    default 'AI Club',
  mission               text,
  meeting_times         text        not null    default 'Every Tuesday at 6 PM',
  rules                 text[],
  contact_email         text        not null    default 'contact.aiclub@gmail.com',
  google_classroom_code text,
  google_classroom_url  text,
  instagram_handle      text,
  instagram_url         text,
  updated_at            timestamptz not null    default now()
);

-- Automatic updated_at timestamp trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_club_info_updated_at on public.club_info;
create trigger set_club_info_updated_at
  before update on public.club_info
  for each row
  execute function public.handle_updated_at();

-- Seed initial row
insert into public.club_info (id) values ('club_main')
  on conflict (id) do nothing;

-- 2. news
create table if not exists public.news (
  id        text        primary key default gen_random_uuid()::text,
  content   text        not null,
  author    text        not null,
  timestamp timestamptz not null default now()
);

create index if not exists news_timestamp_idx on public.news (timestamp desc);

-- 3. events
create table if not exists public.events (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  date        date not null,
  time        time not null,
  location    text not null default '',
  description text not null default ''
);

create index if not exists events_date_idx on public.events (date asc);

-- 4. Enable Row Level Security (RLS)
alter table public.club_info enable row level security;
alter table public.news      enable row level security;
alter table public.events    enable row level security;

-- 5. Explicit SELECT Grants to PostgREST roles (anon + authenticated)
grant select on public.club_info to anon, authenticated;
grant select on public.news      to anon, authenticated;
grant select on public.events    to anon, authenticated;

-- 6. Clean, Idempotent Policies with Explicit Role Targeting
drop policy if exists "Public read club_info" on public.club_info;
create policy "Public read club_info"
  on public.club_info
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read news" on public.news;
create policy "Public read news"
  on public.news
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read events" on public.events;
create policy "Public read events"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- 7. Safe Realtime setup (Checks that publication exists first, then checks tables)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'news'
    ) then
      alter publication supabase_realtime add table public.news;
    end if;

    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
    ) then
      alter publication supabase_realtime add table public.events;
    end if;
  else
    raise notice 'Publication supabase_realtime does not exist yet. Skipping realtime registration.';
  end if;
end $$;
