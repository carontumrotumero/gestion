-- Vanaco Working Force - Server mode schema (sin RPC)
-- Ejecutar completo en Supabase SQL Editor (Run)

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workforce_entries (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists username text;
alter table public.app_users add column if not exists password_hash text;
alter table public.app_users add column if not exists is_admin boolean not null default false;
alter table public.app_users add column if not exists is_active boolean not null default true;
alter table public.app_users add column if not exists created_at timestamptz not null default now();
alter table public.app_users add column if not exists updated_at timestamptz not null default now();

alter table public.workforce_entries add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.workforce_entries add column if not exists is_deleted boolean not null default false;
alter table public.workforce_entries add column if not exists created_at timestamptz not null default now();
alter table public.workforce_entries add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_app_users_username on public.app_users (username);
create index if not exists idx_workforce_entries_created_at on public.workforce_entries (created_at desc);
create index if not exists idx_workforce_entries_is_deleted on public.workforce_entries (is_deleted);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_app_users_updated_at'
      and n.nspname = 'public'
      and c.relname = 'app_users'
  ) then
    create trigger trg_app_users_updated_at
    before update on public.app_users
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_workforce_entries_updated_at'
      and n.nspname = 'public'
      and c.relname = 'workforce_entries'
  ) then
    create trigger trg_workforce_entries_updated_at
    before update on public.workforce_entries
    for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.app_users enable row level security;
alter table public.workforce_entries enable row level security;

-- En modo server se usa service role key desde backend.
-- Se bloquea acceso directo desde anon/authenticated.
