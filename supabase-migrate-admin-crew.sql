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

alter table public.kome_prerush_admin_assignments enable row level security;
