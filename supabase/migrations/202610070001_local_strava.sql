-- MijnLoop v20 - Strava bridge voor lokale MijnLoop-accounts.
-- Supabase Auth wordt NIET gebruikt. De browser heeft per lokaal account een willekeurige
-- integrationSecret; alleen de SHA-256 hash daarvan wordt server-side opgeslagen.

create table if not exists public.mijnloop_local_strava_tokens (
  account_id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
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
  constraint mijnloop_local_strava_state_format check (oauth_state is null or oauth_state ~ '^[a-f0-9]{64}$')
);

alter table public.mijnloop_local_strava_tokens enable row level security;
revoke all on public.mijnloop_local_strava_tokens from public, anon, authenticated;
grant all on public.mijnloop_local_strava_tokens to service_role;

comment on table public.mijnloop_local_strava_tokens is 'Server-only Strava OAuth tokens keyed by MijnLoop local account ID. No Supabase Auth dependency.';
