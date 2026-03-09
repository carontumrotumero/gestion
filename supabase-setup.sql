create extension if not exists "pgcrypto";

create table if not exists public.workforce_entries (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workforce_entries_created_at
on public.workforce_entries (created_at desc);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_team_members_email on public.team_members(lower(email));

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
for each row execute function public.set_updated_at();

drop trigger if exists trg_team_members_updated_at on public.team_members;
create trigger trg_team_members_updated_at
before update on public.team_members
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_members (user_id, email, role, approved)
  values (new.id, new.email, 'viewer', false)
  on conflict (user_id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.team_members enable row level security;
alter table public.workforce_entries enable row level security;

-- Limpieza de políticas antiguas.
drop policy if exists "authenticated_select_workforce_entries" on public.workforce_entries;
drop policy if exists "authenticated_insert_workforce_entries" on public.workforce_entries;
drop policy if exists "authenticated_update_workforce_entries" on public.workforce_entries;
drop policy if exists "authenticated_delete_workforce_entries" on public.workforce_entries;
drop policy if exists "members_can_select_workforce_entries" on public.workforce_entries;
drop policy if exists "admins_can_insert_workforce_entries" on public.workforce_entries;
drop policy if exists "admins_can_update_workforce_entries" on public.workforce_entries;
drop policy if exists "admins_can_delete_workforce_entries" on public.workforce_entries;
drop policy if exists "user_can_select_own_member" on public.team_members;
drop policy if exists "user_can_insert_own_member" on public.team_members;
drop policy if exists "admin_can_select_all_members" on public.team_members;
drop policy if exists "admin_can_update_members" on public.team_members;

create policy "members_can_select_workforce_entries"
on public.workforce_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.approved = true
  )
);

create policy "admins_can_insert_workforce_entries"
on public.workforce_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.approved = true
      and tm.role = 'admin'
  )
);

create policy "admins_can_update_workforce_entries"
on public.workforce_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.approved = true
      and tm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.approved = true
      and tm.role = 'admin'
  )
);

create policy "admins_can_delete_workforce_entries"
on public.workforce_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.approved = true
      and tm.role = 'admin'
  )
);

create policy "user_can_select_own_member"
on public.team_members
for select
to authenticated
using (user_id = auth.uid());

create policy "user_can_insert_own_member"
on public.team_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'viewer'
  and approved = false
);

create policy "admin_can_select_all_members"
on public.team_members
for select
to authenticated
using (
  exists (
    select 1
    from public.team_members me
    where me.user_id = auth.uid()
      and me.role = 'admin'
      and me.approved = true
  )
);

create policy "admin_can_update_members"
on public.team_members
for update
to authenticated
using (
  exists (
    select 1
    from public.team_members me
    where me.user_id = auth.uid()
      and me.role = 'admin'
      and me.approved = true
  )
)
with check (
  exists (
    select 1
    from public.team_members me
    where me.user_id = auth.uid()
      and me.role = 'admin'
      and me.approved = true
  )
);

-- Marca este correo como admin principal (cámbialo si hace falta).
-- Funciona aunque el usuario ya existiera o se hubiera creado antes.
insert into public.team_members (user_id, email, role, approved)
select id, email, 'admin', true
from auth.users
where lower(email) = lower('carontumrotumero@gmail.com')
on conflict (user_id) do update
set role = 'admin', approved = true, email = excluded.email;
