-- Sport-app v3 update: Supabase Auth is the only access gate.
-- Run this ONCE if you already ran 202610060001_sportkompas.sql.

-- Every authenticated user may read only their own state.
drop policy if exists sport_state_read_own on public.sport_states;
create policy sport_state_read_own on public.sport_states
for select to authenticated
using (user_id = (select auth.uid()));

-- Saving is allowed for every authenticated, non-anonymous Supabase user.
create or replace function public.sport_save_state(p_data jsonb, p_expected_revision bigint)
returns table (data jsonb, revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_data jsonb; v_revision bigint;
begin
  if v_user is null then
    raise exception 'SPORT_ACCESS_DENIED' using errcode='42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'SPORT_INVALID_REVISION' using errcode='22023';
  end if;
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object'
    or p_data->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(p_data->'profile') is distinct from 'object'
    or jsonb_typeof(p_data->'workouts') is distinct from 'array'
    or jsonb_typeof(p_data->'slots') is distinct from 'array'
    or jsonb_typeof(p_data->'adjustments') is distinct from 'array'
    or octet_length(p_data::text) > 2097152 then
      raise exception 'SPORT_INVALID_DATA' using errcode='22023';
  end if;
  if jsonb_array_length(p_data->'workouts') > 3000
     or jsonb_array_length(p_data->'slots') > 14
     or jsonb_array_length(p_data->'adjustments') > 200 then
    raise exception 'SPORT_DATA_LIMIT' using errcode='22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.sport_states as s(user_id,data,revision,updated_at)
    values(v_user,p_data,1,now()) on conflict(user_id) do nothing
    returning s.data,s.revision into v_data,v_revision;
  else
    update public.sport_states as s set data=p_data,revision=s.revision+1,updated_at=now()
    where s.user_id=v_user and s.revision=p_expected_revision
    returning s.data,s.revision into v_data,v_revision;
  end if;
  if not found then raise exception 'SPORT_CONFLICT' using errcode='40001'; end if;
  return query select v_data,v_revision;
end;
$$;
revoke all on function public.sport_save_state(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.sport_save_state(jsonb,bigint) to authenticated;

-- AI quota no longer checks a separate allow-list.
create or replace function public.sport_take_ai_quota(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_calls integer;
begin
  if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id and is_anonymous is not true) then return false; end if;
  insert into public.sport_ai_usage as u(user_id,day,calls,last_used)
  values(p_user_id,(now() at time zone 'UTC')::date,1,now())
  on conflict(user_id,day) do update set calls=u.calls+1,last_used=now()
  where u.calls<10 and u.last_used<now()-interval '10 seconds'
  returning calls into v_calls;
  return v_calls is not null;
end;
$$;
revoke all on function public.sport_take_ai_quota(uuid) from public,anon,authenticated;
grant execute on function public.sport_take_ai_quota(uuid) to service_role;

-- The old allow-list is no longer used.
drop table if exists public.sport_members cascade;
