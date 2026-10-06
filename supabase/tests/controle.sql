-- Read-only inspection. Run as project admin AFTER the migration.
-- This is NOT a live end-to-end RLS test and never changes users or records.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('sport_members','sport_states','sport_calendar_tokens','sport_ai_usage')
order by c.relname;

select tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename like 'sport_%'
order by tablename,policyname;

select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name like 'sport_%'
  and grantee in ('anon','authenticated','PUBLIC','service_role')
order by table_name,grantee,privilege_type;
-- Expected: authenticated only SELECT on sport_members and sport_states.
-- Expected: no anon/PUBLIC table privileges. service_role has admin privileges.

select
 has_function_privilege('anon','public.sport_save_state(jsonb,bigint)','EXECUTE') as anon_save_must_be_false,
 has_function_privilege('authenticated','public.sport_save_state(jsonb,bigint)','EXECUTE') as user_save_must_be_true,
 has_function_privilege('authenticated','public.sport_take_ai_quota(uuid)','EXECUTE') as user_quota_must_be_false,
 has_function_privilege('service_role','public.sport_take_ai_quota(uuid)','EXECUTE') as server_quota_must_be_true;

select p.proname,p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('sport_save_state','sport_take_ai_quota');
-- Expected: security definer = true; empty search_path in proconfig.
