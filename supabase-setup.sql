create table if not exists public.kome_prerush_entries (
  id text primary key,
  artist text not null check (char_length(artist) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  parent_slot integer not null check (parent_slot between 1 and 13),
  parent_slot_detail text not null default '' check (char_length(parent_slot_detail) <= 80),
  parent_number integer not null default 1 check (parent_number between 1 and 5),
  start_time text not null check (start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'),
  url text not null check (url ~ '^https?://'),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deleted')),
  review_note text not null default '',
  reviewed_at timestamptz,
  applicant_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.kome_prerush_official_videos (
  id text primary key,
  title text not null check (char_length(title) between 1 and 120),
  start_time text not null check (start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'),
  url text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.kome_prerush_settings (
  id text primary key,
  event_date text check (event_date is null or event_date ~ '^\d{4}-\d{2}-\d{2}$'),
  official_name text not null,
  official_url text not null check (official_url ~ '^https?://'),
  event_hashtag text,
  x_search_url text,
  live_playlist_url text,
  archive_playlist_url text,
  entry_close_minutes integer not null default 15 check (entry_close_minutes between 5 and 120),
  updated_at timestamptz not null default now()
);

create table if not exists public.kome_prerush_admin_assignments (
  discord_user_id text primary key,
  discord_username text not null,
  discord_global_name text,
  credit_name text not null check (char_length(credit_name) between 1 and 80),
  assigned_lanes text not null check (char_length(assigned_lanes) between 1 and 120),
  song_count integer not null default 1 check (song_count between 1 and 99),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.kome_prerush_entries add column if not exists review_note text not null default '';
alter table public.kome_prerush_entries add column if not exists reviewed_at timestamptz;
alter table public.kome_prerush_entries add column if not exists applicant_key text;
alter table public.kome_prerush_entries add column if not exists parent_number integer;
alter table public.kome_prerush_entries add column if not exists parent_slot_detail text;
update public.kome_prerush_entries set parent_slot_detail = '' where parent_slot_detail is null;
alter table public.kome_prerush_entries alter column parent_slot_detail set default '';
alter table public.kome_prerush_entries alter column parent_slot_detail set not null;
update public.kome_prerush_entries set parent_number = 1 where parent_number is null;
alter table public.kome_prerush_entries alter column parent_number set default 1;
alter table public.kome_prerush_entries alter column parent_number set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.kome_prerush_entries'::regclass
      and conname = 'kome_prerush_entries_status_check'
  ) then
    alter table public.kome_prerush_entries
      drop constraint kome_prerush_entries_status_check;
  end if;

  alter table public.kome_prerush_entries
    add constraint kome_prerush_entries_status_check
    check (status in ('pending', 'approved', 'rejected', 'deleted'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.kome_prerush_entries'::regclass
      and conname = 'kome_prerush_entries_parent_number_check'
  ) then
    alter table public.kome_prerush_entries
      drop constraint kome_prerush_entries_parent_number_check;
  end if;

  alter table public.kome_prerush_entries
    add constraint kome_prerush_entries_parent_number_check
    check (parent_number between 1 and 5);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.kome_prerush_entries'::regclass
      and conname = 'kome_prerush_entries_parent_slot_check'
  ) then
    alter table public.kome_prerush_entries
      drop constraint kome_prerush_entries_parent_slot_check;
  end if;

  alter table public.kome_prerush_entries
    add constraint kome_prerush_entries_parent_slot_check
    check (parent_slot between 1 and 13);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.kome_prerush_entries'::regclass
      and conname = 'kome_prerush_entries_parent_slot_detail_check'
  ) then
    alter table public.kome_prerush_entries
      drop constraint kome_prerush_entries_parent_slot_detail_check;
  end if;

  alter table public.kome_prerush_entries
    add constraint kome_prerush_entries_parent_slot_detail_check
    check (char_length(parent_slot_detail) <= 80);
exception
  when duplicate_object then null;
end $$;

create index if not exists kome_prerush_entries_applicant_key_idx
  on public.kome_prerush_entries (applicant_key, created_at desc);

alter table public.kome_prerush_entries enable row level security;
alter table public.kome_prerush_official_videos enable row level security;
alter table public.kome_prerush_settings enable row level security;
alter table public.kome_prerush_admin_assignments enable row level security;

drop policy if exists "public can read approved entries" on public.kome_prerush_entries;
create policy "public can read approved entries"
on public.kome_prerush_entries
for select
to anon, authenticated
using (status = 'approved');

drop policy if exists "public can submit pending entries" on public.kome_prerush_entries;
create policy "public can submit pending entries"
on public.kome_prerush_entries
for insert
to anon, authenticated
with check (
  status = 'pending'
  and parent_slot between 1 and 13
  and parent_number between 1 and 5
  and start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
  and review_note = ''
  and reviewed_at is null
  and applicant_key is null
);

drop policy if exists "public can read official videos" on public.kome_prerush_official_videos;
create policy "public can read official videos"
on public.kome_prerush_official_videos
for select
to anon, authenticated
using (true);

drop policy if exists "public can read settings" on public.kome_prerush_settings;
create policy "public can read settings"
on public.kome_prerush_settings
for select
to anon, authenticated
using (true);

insert into public.kome_prerush_settings (
  id,
  event_date,
  official_name,
  official_url,
  event_hashtag,
  x_search_url,
  live_playlist_url,
  archive_playlist_url,
  entry_close_minutes
) values (
  'default',
  '2026-08-08',
  '全てお米の所為です。',
  'https://www.youtube.com/@or_should_rice',
  '#米プレラ',
  '',
  '',
  '',
  15
)
on conflict (id) do update
set event_date = excluded.event_date,
    official_name = excluded.official_name,
    official_url = excluded.official_url,
    event_hashtag = excluded.event_hashtag,
    x_search_url = excluded.x_search_url,
    live_playlist_url = excluded.live_playlist_url,
    archive_playlist_url = excluded.archive_playlist_url,
    entry_close_minutes = excluded.entry_close_minutes,
    updated_at = now();
