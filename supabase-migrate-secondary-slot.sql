alter table public.kome_prerush_entries add column if not exists parent_slot_detail text;
update public.kome_prerush_entries set parent_slot_detail = '' where parent_slot_detail is null;
alter table public.kome_prerush_entries alter column parent_slot_detail set default '';
alter table public.kome_prerush_entries alter column parent_slot_detail set not null;

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

drop policy if exists "public can submit entries" on public.kome_prerush_entries;
create policy "public can submit entries"
on public.kome_prerush_entries
for insert
to anon, authenticated
with check (
  status = 'pending'
  and char_length(artist) between 1 and 80
  and char_length(title) between 1 and 120
  and parent_slot between 1 and 13
  and parent_number between 1 and 5
  and char_length(parent_slot_detail) <= 80
  and start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
  and review_note = ''
  and reviewed_at is null
  and applicant_key is null
);
