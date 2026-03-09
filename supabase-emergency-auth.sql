-- Emergency auth patch for Vanaco Working Force
-- Non-destructive: only CREATE/ALTER/GRANT/NOTIFY.

create extension if not exists "pgcrypto";

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
  user_id uuid not null references public.app_users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;

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

create or replace function public.app_bootstrap_admin(p_password text, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_user public.app_users;
begin
  select count(*) into v_count from public.app_users;
  if v_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'Ya existe al menos un usuario.');
  end if;

  insert into public.app_users(username, password_hash, is_admin, is_active)
  values (lower(trim(p_username)), crypt(p_password, gen_salt('bf')), true, true)
  returning * into v_user;

  return jsonb_build_object('ok', true, 'user', to_jsonb(v_user));
end;
$$;

create or replace function public.app_bootstrap_admin_json(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.app_bootstrap_admin(
    p_payload ->> 'password',
    p_payload ->> 'username'
  );
$$;

create or replace function public.app_login(p_password text, p_username text)
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

create or replace function public.app_login_json(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.app_login(
    p_payload ->> 'password',
    p_payload ->> 'username'
  );
$$;

create or replace function public.app_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_sessions
  set expires_at = now()
  where token = p_token;
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

grant usage on schema public to anon, authenticated;
grant execute on function public.app_user_from_token(text) to anon, authenticated;
grant execute on function public.app_bootstrap_admin(text, text) to anon, authenticated;
grant execute on function public.app_bootstrap_admin_json(jsonb) to anon, authenticated;
grant execute on function public.app_login(text, text) to anon, authenticated;
grant execute on function public.app_login_json(jsonb) to anon, authenticated;
grant execute on function public.app_logout(text) to anon, authenticated;
grant execute on function public.app_me(text) to anon, authenticated;

notify pgrst, 'reload schema';
