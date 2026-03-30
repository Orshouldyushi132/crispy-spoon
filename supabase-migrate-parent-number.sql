alter table public.kome_prerush_entries
  add column if not exists parent_number integer;

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

update public.kome_prerush_entries
set parent_number = 1
where parent_number is null;

alter table public.kome_prerush_entries
  alter column parent_number set default 1;

alter table public.kome_prerush_entries
  alter column parent_number set not null;

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

drop policy if exists "public can submit pending entries" on public.kome_prerush_entries;

create policy "public can submit pending entries"
on public.kome_prerush_entries
for insert
to anon, authenticated
with check (
  status = 'pending'
  and parent_slot between 1 and 12
  and parent_number between 1 and 5
  and start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
  and review_note = ''
  and reviewed_at is null
  and applicant_key is null
);
