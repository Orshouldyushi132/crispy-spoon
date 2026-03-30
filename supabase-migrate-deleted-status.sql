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
