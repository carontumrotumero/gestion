create extension if not exists "pgcrypto";

create table if not exists public.workforce_entries (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workforce_entries_created_at
on public.workforce_entries (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workforce_entries_updated_at on public.workforce_entries;
create trigger trg_workforce_entries_updated_at
before update on public.workforce_entries
for each row
execute function public.set_updated_at();

alter table public.workforce_entries enable row level security;

-- Solo usuarios autenticados pueden leer/escribir.
drop policy if exists "authenticated_select_workforce_entries" on public.workforce_entries;
create policy "authenticated_select_workforce_entries"
on public.workforce_entries
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_workforce_entries" on public.workforce_entries;
create policy "authenticated_insert_workforce_entries"
on public.workforce_entries
for insert
to authenticated
with check (true);

drop policy if exists "authenticated_update_workforce_entries" on public.workforce_entries;
create policy "authenticated_update_workforce_entries"
on public.workforce_entries
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated_delete_workforce_entries" on public.workforce_entries;
create policy "authenticated_delete_workforce_entries"
on public.workforce_entries
for delete
to authenticated
using (true);
