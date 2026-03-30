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
    check (parent_slot between 1 and 6);
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
  and parent_slot between 1 and 6
  and start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
  and review_note = ''
  and reviewed_at is null
  and applicant_key is null
);
