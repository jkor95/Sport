-- MijnLoop v12 - eenmalige Strava koppeling (zelfde schema als v11).
-- Alleen nodig als je automatische Strava/Garmin-via-Strava import wilt gebruiken.
-- Tokens zijn NOOIT leesbaar voor anon/authenticated; alleen de Edge Function met service_role gebruikt deze tabel.

create table if not exists public.sport_strava_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  athlete_id bigint,
  athlete_name text,
  access_token text,
  refresh_token text,
  expires_at bigint,
  scope text,
  connected_at timestamptz,
  last_sync timestamptz,
  oauth_state text unique,
  oauth_expires timestamptz,
  return_url text,
  updated_at timestamptz not null default now(),
  constraint sport_strava_oauth_state_format check (oauth_state is null or oauth_state ~ '^[a-f0-9]{64}$')
);

alter table public.sport_strava_tokens enable row level security;
revoke all on public.sport_strava_tokens from public, anon, authenticated;
grant all on public.sport_strava_tokens to service_role;

comment on table public.sport_strava_tokens is 'Server-only OAuth tokens for MijnLoop Strava integration; never exposed to browser roles.';
