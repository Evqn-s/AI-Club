-- 1. club_info
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

-- 5. Permissions for Supabase API
grant select on public.club_info to anon, authenticated;
grant select on public.news      to anon, authenticated;
grant select on public.events    to anon, authenticated;

-- 6. Read policies
drop policy if exists "Public read club_info" on public.club_info;
create policy "Public read club_info"
  on public.club_info for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read news" on public.news;
create policy "Public read news"
  on public.news for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read events" on public.events;
create policy "Public read events"
  on public.events for select
  to anon, authenticated
  using (true);
