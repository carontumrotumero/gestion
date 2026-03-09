-- Vanaco Working Force - Auth por usuario/contraseña (sin email)
-- Ejecutar completo en SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.workforce_entries (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workforce_entries_created_at
on public.workforce_entries (created_at desc);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_app_sessions_user_id on public.app_sessions(user_id);
create index if not exists idx_app_sessions_expires_at on public.app_sessions(expires_at);

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
    where t.tgname = 'trg_workforce_entries_updated_at'
      and n.nspname = 'public'
      and c.relname = 'workforce_entries'
  ) then
    create trigger trg_workforce_entries_updated_at
    before update on public.workforce_entries
    for each row execute function public.set_updated_at();
  end if;

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
end
$$;

alter table public.workforce_entries enable row level security;
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;

-- Sin políticas: acceso directo bloqueado para anon/authenticated.

do $$
begin
  if exists (
    select 1 from information_schema.routines
    where routine_schema = 'public' and routine_name = 'app_hash_password'
  ) then
    drop function public.app_hash_password(text);
  end if;
end $$;

create or replace function public.app_user_from_token(p_token text)
returns public.app_users
language sql
security definer
set search_path = public
as $$
  select u.*
  from public.app_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = p_token
    and s.expires_at > now()
    and u.is_active = true
  limit 1;
$$;

create or replace function public.app_has_users()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.app_users);
$$;

create or replace function public.app_bootstrap_admin(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_count int;
  v_user public.app_users;
begin
  select count(*) into v_user_count from public.app_users;
  if v_user_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'Ya existe al menos un usuario.');
  end if;

  insert into public.app_users(username, password_hash, is_admin, is_active)
  values (lower(trim(p_username)), crypt(p_password, gen_salt('bf')), true, true)
  returning * into v_user;

  return jsonb_build_object('ok', true, 'user', to_jsonb(v_user));
end;
$$;

create or replace function public.app_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_token text;
begin
  select * into v_user
  from public.app_users
  where username = lower(trim(p_username))
    and is_active = true
    and password_hash = crypt(p_password, password_hash)
  limit 1;

  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'Credenciales inválidas.');
  end if;

  delete from public.app_sessions
  where user_id = v_user.id
    and expires_at < now();

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.app_sessions(token, user_id, expires_at)
  values (v_token, v_user.id, now() + interval '30 days');

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'is_admin', v_user.is_admin,
      'is_active', v_user.is_active
    )
  );
end;
$$;

create or replace function public.app_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.app_sessions where token = p_token;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
begin
  select * into v_user from public.app_user_from_token(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión inválida.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'is_admin', v_user.is_admin,
      'is_active', v_user.is_active
    )
  );
end;
$$;

create or replace function public.app_get_entries(p_token text, p_limit int default 500)
returns table(id uuid, data jsonb, created_at timestamptz, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
begin
  select * into v_user from public.app_user_from_token(p_token);
  if v_user.id is null then
    raise exception 'Sesión inválida';
  end if;

  return query
  select e.id, e.data, e.created_at, e.updated_at
  from public.workforce_entries e
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

create or replace function public.app_create_entry(p_token text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_id uuid;
begin
  select * into v_user from public.app_user_from_token(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión inválida');
  end if;
  if not v_user.is_admin then
    return jsonb_build_object('ok', false, 'error', 'Solo admin puede crear');
  end if;

  insert into public.workforce_entries(data)
  values (coalesce(p_data, '{}'::jsonb))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.app_update_entry(p_token text, p_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
begin
  select * into v_user from public.app_user_from_token(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión inválida');
  end if;
  if not v_user.is_admin then
    return jsonb_build_object('ok', false, 'error', 'Solo admin puede editar');
  end if;

  update public.workforce_entries
  set data = coalesce(p_data, '{}'::jsonb)
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_delete_entry(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
begin
  select * into v_user from public.app_user_from_token(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión inválida');
  end if;
  if not v_user.is_admin then
    return jsonb_build_object('ok', false, 'error', 'Solo admin puede eliminar');
  end if;

  delete from public.workforce_entries where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_replace_entries(p_token text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_item jsonb;
begin
  select * into v_user from public.app_user_from_token(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión inválida');
  end if;
  if not v_user.is_admin then
    return jsonb_build_object('ok', false, 'error', 'Solo admin puede importar');
  end if;

  delete from public.workforce_entries;

  if jsonb_typeof(p_rows) = 'array' then
    for v_item in select * from jsonb_array_elements(p_rows)
    loop
      insert into public.workforce_entries(data)
      values (coalesce(v_item, '{}'::jsonb));
    end loop;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_list_users(p_token text)
returns table(id uuid, username text, is_admin boolean, is_active boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
begin
  select * into v_user from public.app_user_from_token(p_token);
  if v_user.id is null then
    raise exception 'Sesión inválida';
  end if;
  if not v_user.is_admin then
    raise exception 'Solo admin';
  end if;

  return query
  select u.id, u.username, u.is_admin, u.is_active, u.created_at
  from public.app_users u
  order by u.created_at desc;
end;
$$;

create or replace function public.app_create_user(
  p_token text,
  p_username text,
  p_password text,
  p_is_admin boolean default false,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.app_users;
  v_new public.app_users;
begin
  select * into v_admin from public.app_user_from_token(p_token);
  if v_admin.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión inválida');
  end if;
  if not v_admin.is_admin then
    return jsonb_build_object('ok', false, 'error', 'Solo admin puede crear usuarios');
  end if;

  insert into public.app_users(username, password_hash, is_admin, is_active)
  values (
    lower(trim(p_username)),
    crypt(p_password, gen_salt('bf')),
    coalesce(p_is_admin, false),
    coalesce(p_is_active, true)
  )
  returning * into v_new;

  return jsonb_build_object('ok', true, 'user', to_jsonb(v_new));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Ese usuario ya existe.');
end;
$$;

create or replace function public.app_update_user(
  p_token text,
  p_user_id uuid,
  p_is_admin boolean,
  p_is_active boolean,
  p_new_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.app_users;
begin
  select * into v_admin from public.app_user_from_token(p_token);
  if v_admin.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión inválida');
  end if;
  if not v_admin.is_admin then
    return jsonb_build_object('ok', false, 'error', 'Solo admin');
  end if;

  update public.app_users
  set is_admin = coalesce(p_is_admin, is_admin),
      is_active = coalesce(p_is_active, is_active),
      password_hash = case
        when p_new_password is null or length(trim(p_new_password)) = 0 then password_hash
        else crypt(p_new_password, gen_salt('bf'))
      end
  where id = p_user_id;

  delete from public.app_sessions where user_id = p_user_id and expires_at < now();

  return jsonb_build_object('ok', true);
end;
$$;

-- Permisos RPC para anon/authenticated
grant usage on schema public to anon, authenticated;
grant execute on function public.app_has_users() to anon, authenticated;
grant execute on function public.app_bootstrap_admin(text, text) to anon, authenticated;
grant execute on function public.app_login(text, text) to anon, authenticated;
grant execute on function public.app_logout(text) to anon, authenticated;
grant execute on function public.app_me(text) to anon, authenticated;
grant execute on function public.app_get_entries(text, int) to anon, authenticated;
grant execute on function public.app_create_entry(text, jsonb) to anon, authenticated;
grant execute on function public.app_update_entry(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.app_delete_entry(text, uuid) to anon, authenticated;
grant execute on function public.app_replace_entries(text, jsonb) to anon, authenticated;
grant execute on function public.app_list_users(text) to anon, authenticated;
grant execute on function public.app_create_user(text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.app_update_user(text, uuid, boolean, boolean, text) to anon, authenticated;

notify pgrst, 'reload schema';
