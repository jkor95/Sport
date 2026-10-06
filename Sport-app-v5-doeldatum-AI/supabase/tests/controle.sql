-- Sport-app v3 control queries. Run manually after installing/upgrading.
select table_name from information_schema.tables
where table_schema='public' and table_name in ('sport_states','sport_calendar_tokens','sport_ai_usage')
order by table_name;

select schemaname,tablename,policyname,roles,cmd,qual
from pg_policies
where schemaname='public' and tablename='sport_states';

-- sport_members should no longer exist:
select to_regclass('public.sport_members') as sport_members_should_be_null;
