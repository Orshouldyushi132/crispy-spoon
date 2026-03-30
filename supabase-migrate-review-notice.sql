alter table public.kome_prerush_entries
  add column if not exists review_note text;

update public.kome_prerush_entries
set review_note = ''
where review_note is null;

alter table public.kome_prerush_entries
  alter column review_note set default '';

alter table public.kome_prerush_entries
  alter column review_note set not null;

alter table public.kome_prerush_entries
  add column if not exists reviewed_at timestamptz;

alter table public.kome_prerush_entries
  add column if not exists applicant_key text;

create index if not exists kome_prerush_entries_applicant_key_idx
  on public.kome_prerush_entries (applicant_key, created_at desc);

drop policy if exists "public can submit pending entries" on public.kome_prerush_entries;

create policy "public can submit pending entries"
on public.kome_prerush_entries
for insert
to anon, authenticated
with check (
  status = 'pending'
  and parent_slot between 1 and 12
  and start_time ~ '^(?:[01]\\d|2[0-3]):[0-5]\\d$'
  and review_note = ''
  and reviewed_at is null
  and applicant_key is null
);
