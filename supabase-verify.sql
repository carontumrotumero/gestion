-- Verificacion rapida de setup para Vanaco Working Force
-- Ejecutar en SQL Editor del mismo proyecto al que apunta la web de Vercel.

with required_tables(name) as (
  values
    ('app_users'),
    ('app_sessions'),
    ('workforce_entries')
),
required_functions(signature) as (
  values
    ('app_has_users()'),
    ('app_bootstrap_admin(p_password text, p_username text)'),
    ('app_bootstrap_admin_json(p_payload jsonb)'),
    ('app_login(p_password text, p_username text)'),
    ('app_login_json(p_payload jsonb)'),
    ('app_logout(p_token text)'),
    ('app_me(p_token text)'),
    ('app_get_entries(p_token text, p_limit integer)'),
    ('app_create_entry(p_token text, p_data jsonb)'),
    ('app_update_entry(p_token text, p_id uuid, p_data jsonb)'),
    ('app_delete_entry(p_token text, p_id uuid)'),
    ('app_replace_entries(p_token text, p_rows jsonb)'),
    ('app_list_users(p_token text)'),
    ('app_create_user(p_token text, p_username text, p_password text, p_is_admin boolean, p_is_active boolean)'),
    ('app_update_user(p_token text, p_user_id uuid, p_is_admin boolean, p_is_active boolean, p_new_password text)')
),
existing_functions as (
  select
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
missing_tables as (
  select rt.name
  from required_tables rt
  left join pg_class c on c.relname = rt.name
  left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.oid is null or n.oid is null
),
missing_functions as (
  select rf.signature
  from required_functions rf
  left join existing_functions ef on ef.signature = rf.signature
  where ef.signature is null
),
grant_checks as (
  select
    'app_login_json(jsonb)'::text as target,
    has_function_privilege('anon', 'public.app_login_json(jsonb)', 'EXECUTE') as anon_ok,
    has_function_privilege('authenticated', 'public.app_login_json(jsonb)', 'EXECUTE') as auth_ok
  union all
  select
    'app_get_entries(text, integer)'::text,
    has_function_privilege('anon', 'public.app_get_entries(text, integer)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.app_get_entries(text, integer)', 'EXECUTE')
),
summary as (
  select
    (select count(*) from missing_tables) as missing_tables_count,
    (select count(*) from missing_functions) as missing_functions_count,
    (select count(*) from grant_checks where not (anon_ok and auth_ok)) as bad_grants_count
)
select * from summary;

with required_tables(name) as (
  values
    ('app_users'),
    ('app_sessions'),
    ('workforce_entries')
),
required_functions(signature) as (
  values
    ('app_has_users()'),
    ('app_bootstrap_admin(p_password text, p_username text)'),
    ('app_bootstrap_admin_json(p_payload jsonb)'),
    ('app_login(p_password text, p_username text)'),
    ('app_login_json(p_payload jsonb)'),
    ('app_logout(p_token text)'),
    ('app_me(p_token text)'),
    ('app_get_entries(p_token text, p_limit integer)'),
    ('app_create_entry(p_token text, p_data jsonb)'),
    ('app_update_entry(p_token text, p_id uuid, p_data jsonb)'),
    ('app_delete_entry(p_token text, p_id uuid)'),
    ('app_replace_entries(p_token text, p_rows jsonb)'),
    ('app_list_users(p_token text)'),
    ('app_create_user(p_token text, p_username text, p_password text, p_is_admin boolean, p_is_active boolean)'),
    ('app_update_user(p_token text, p_user_id uuid, p_is_admin boolean, p_is_active boolean, p_new_password text)')
),
existing_functions as (
  select
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
missing_tables as (
  select rt.name
  from required_tables rt
  left join pg_class c on c.relname = rt.name
  left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.oid is null or n.oid is null
),
missing_functions as (
  select rf.signature
  from required_functions rf
  left join existing_functions ef on ef.signature = rf.signature
  where ef.signature is null
),
grant_checks as (
  select
    'app_login_json(jsonb)'::text as target,
    has_function_privilege('anon', 'public.app_login_json(jsonb)', 'EXECUTE') as anon_ok,
    has_function_privilege('authenticated', 'public.app_login_json(jsonb)', 'EXECUTE') as auth_ok
  union all
  select
    'app_get_entries(text, integer)'::text,
    has_function_privilege('anon', 'public.app_get_entries(text, integer)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.app_get_entries(text, integer)', 'EXECUTE')
)
select 'missing_table' as issue_type, name as detail from missing_tables
union all
select 'missing_function' as issue_type, signature as detail from missing_functions
union all
select
  'bad_grant' as issue_type,
  target || ' anon=' || anon_ok || ' authenticated=' || auth_ok as detail
from grant_checks
where not (anon_ok and auth_ok)
order by issue_type, detail;
