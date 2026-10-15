-- MijnLoop v36 Web Push. De echte VAPID/private waarden en cron-secret staan niet in Git.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create table if not exists public.mijnloop_push_config (id smallint primary key check (id=1),vapid_public text not null,vapid_private text not null,cron_secret text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.mijnloop_push_config enable row level security;
revoke all on public.mijnloop_push_config from anon,authenticated;
grant select,insert,update,delete on public.mijnloop_push_config to service_role;
create table if not exists public.mijnloop_push_subscriptions (endpoint text primary key,account_id uuid not null references public.mijnloop_accounts(id) on delete cascade,subscription jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.mijnloop_push_subscriptions enable row level security;
revoke all on public.mijnloop_push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.mijnloop_push_subscriptions to service_role;
create index if not exists mijnloop_push_subscriptions_account_idx on public.mijnloop_push_subscriptions(account_id);
create table if not exists public.mijnloop_push_events (account_id uuid not null references public.mijnloop_accounts(id) on delete cascade,event_key text not null,category text not null check(category in ('upcoming','pending')),workout_id text,created_at timestamptz not null default now(),sent_at timestamptz,primary key(account_id,event_key));
alter table public.mijnloop_push_events enable row level security;
revoke all on public.mijnloop_push_events from anon,authenticated;
grant select,insert,update,delete on public.mijnloop_push_events to service_role;
