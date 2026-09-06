-- Discord analytics storage.  These tables are intentionally server-only:
-- the Express API uses Supabase service-role credentials and browser clients
-- receive only aggregated, admin-authorized responses.

create table if not exists public.discord_analytics_settings (
  guild_id text primary key,
  enabled boolean not null default true,
  tracking_started_at timestamptz,
  timezone text not null default 'UTC',
  presence_tracking_enabled boolean not null default false,
  ignored_channel_ids jsonb not null default '[]'::jsonb,
  ignored_role_ids jsonb not null default '[]'::jsonb,
  alert_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_analytics_members (
  guild_id text not null,
  user_id text not null,
  username text,
  display_name text,
  is_bot boolean not null default false,
  avatar_present boolean,
  joined_at timestamptz,
  account_created_at timestamptz,
  account_age_at_join_seconds bigint,
  pending_at_join boolean,
  roles_at_join jsonb not null default '[]'::jsonb,
  current_roles jsonb not null default '[]'::jsonb,
  invite_code text,
  inviter_id text,
  first_message_at timestamptz,
  first_voice_at timestamptz,
  last_activity_at timestamptz,
  left_at timestamptz,
  is_current boolean not null default true,
  source text not null default 'gateway',
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.discord_analytics_member_events (
  event_key text primary key,
  guild_id text not null,
  user_id text not null,
  event_type text not null check (event_type in ('join', 'leave', 'message', 'voice_join', 'voice_leave', 'presence')),
  occurred_at timestamptz not null,
  origin text not null default 'gateway',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.discord_analytics_member_count_snapshots (
  id bigint generated always as identity primary key,
  guild_id text not null,
  bucket_start timestamptz not null,
  resolution text not null default '5m',
  source text not null default 'gateway',
  member_count integer not null default 0,
  human_count integer not null default 0,
  bot_count integer not null default 0,
  online_count integer,
  voice_count integer not null default 0,
  unique (guild_id, bucket_start, resolution, source)
);

create table if not exists public.discord_analytics_messages (
  message_id text primary key,
  guild_id text not null,
  channel_id text not null,
  channel_name text,
  author_id text not null,
  is_bot boolean not null default false,
  sent_at timestamptz not null,
  message_type text,
  has_reply boolean not null default false,
  attachment_count integer not null default 0,
  reaction_count integer not null default 0,
  origin text not null default 'gateway'
);

create table if not exists public.discord_analytics_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  channel_id text not null,
  channel_name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  origin text not null default 'gateway',
  unique (guild_id, user_id, channel_id, started_at)
);

create table if not exists public.discord_analytics_invites (
  guild_id text not null,
  code text not null,
  inviter_id text,
  inviter_username text,
  uses integer not null default 0,
  max_uses integer,
  expires_at timestamptz,
  created_at timestamptz,
  snapshot_at timestamptz not null default now(),
  active boolean not null default true,
  primary key (guild_id, code)
);

create table if not exists public.discord_analytics_backfill_jobs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  kind text not null check (kind in ('members', 'messages', 'voice_reconcile')),
  status text not null default 'queued' check (status in ('queued', 'running', 'paused', 'complete', 'failed', 'cancelled')),
  cursor jsonb not null default '{}'::jsonb,
  processed_count integer not null default 0,
  total_hint integer,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_analytics_daily_stats (
  guild_id text not null,
  day date not null,
  joins integer not null default 0,
  leaves integer not null default 0,
  messages integer not null default 0,
  active_members integer not null default 0,
  unique_senders integer not null default 0,
  voice_minutes integer not null default 0,
  ending_member_count integer,
  source text not null default 'computed',
  refreshed_at timestamptz not null default now(),
  primary key (guild_id, day)
);

create table if not exists public.discord_analytics_anomaly_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  kind text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  score numeric not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.discord_analytics_stat_roles (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  role_id text not null,
  metric text not null check (metric in ('message_count', 'voice_minutes', 'joined_days')),
  threshold integer not null check (threshold >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, role_id, metric)
);

create table if not exists public.discord_analytics_counters (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  metric text not null check (metric in ('members', 'online', 'voice', 'messages_today')),
  format text not null default '{value}',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (guild_id, channel_id, metric)
);

create table if not exists public.discord_analytics_audit_log (
  id bigint generated always as identity primary key,
  guild_id text not null,
  actor_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Event ingestion may observe several messages from the same member. Preserve
-- the first activity timestamp while allowing the latest activity to advance.
create or replace function public.discord_analytics_preserve_first_activity()
returns trigger
language plpgsql
as $$
begin
  new.first_message_at := coalesce(old.first_message_at, new.first_message_at);
  new.first_voice_at := coalesce(old.first_voice_at, new.first_voice_at);
  return new;
end;
$$;

drop trigger if exists discord_analytics_preserve_first_activity on public.discord_analytics_members;
create trigger discord_analytics_preserve_first_activity
before update on public.discord_analytics_members
for each row execute function public.discord_analytics_preserve_first_activity();

create index if not exists discord_analytics_members_current_idx on public.discord_analytics_members (guild_id, is_current, joined_at desc);
create index if not exists discord_analytics_events_guild_time_idx on public.discord_analytics_member_events (guild_id, occurred_at desc);
create index if not exists discord_analytics_messages_guild_time_idx on public.discord_analytics_messages (guild_id, sent_at desc);
create index if not exists discord_analytics_messages_channel_time_idx on public.discord_analytics_messages (guild_id, channel_id, sent_at desc);
create index if not exists discord_analytics_voice_guild_time_idx on public.discord_analytics_voice_sessions (guild_id, started_at desc);
create index if not exists discord_analytics_jobs_active_idx on public.discord_analytics_backfill_jobs (guild_id, status, created_at desc);
create index if not exists discord_analytics_anomalies_guild_time_idx on public.discord_analytics_anomaly_events (guild_id, detected_at desc);

alter table public.discord_analytics_settings enable row level security;
alter table public.discord_analytics_members enable row level security;
alter table public.discord_analytics_member_events enable row level security;
alter table public.discord_analytics_member_count_snapshots enable row level security;
alter table public.discord_analytics_messages enable row level security;
alter table public.discord_analytics_voice_sessions enable row level security;
alter table public.discord_analytics_invites enable row level security;
alter table public.discord_analytics_backfill_jobs enable row level security;
alter table public.discord_analytics_daily_stats enable row level security;
alter table public.discord_analytics_anomaly_events enable row level security;
alter table public.discord_analytics_stat_roles enable row level security;
alter table public.discord_analytics_counters enable row level security;
alter table public.discord_analytics_audit_log enable row level security;

revoke all on table public.discord_analytics_settings from anon, authenticated;
revoke all on table public.discord_analytics_members from anon, authenticated;
revoke all on table public.discord_analytics_member_events from anon, authenticated;
revoke all on table public.discord_analytics_member_count_snapshots from anon, authenticated;
revoke all on table public.discord_analytics_messages from anon, authenticated;
revoke all on table public.discord_analytics_voice_sessions from anon, authenticated;
revoke all on table public.discord_analytics_invites from anon, authenticated;
revoke all on table public.discord_analytics_backfill_jobs from anon, authenticated;
revoke all on table public.discord_analytics_daily_stats from anon, authenticated;
revoke all on table public.discord_analytics_anomaly_events from anon, authenticated;
revoke all on table public.discord_analytics_stat_roles from anon, authenticated;
revoke all on table public.discord_analytics_counters from anon, authenticated;
revoke all on table public.discord_analytics_audit_log from anon, authenticated;

-- Defense in depth: browser roles have no table grants, and this explicit
-- deny policy keeps the server-only intent intact if a future grant is added.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'discord_analytics_settings', 'discord_analytics_members', 'discord_analytics_member_events',
    'discord_analytics_member_count_snapshots', 'discord_analytics_messages', 'discord_analytics_voice_sessions',
    'discord_analytics_invites', 'discord_analytics_backfill_jobs', 'discord_analytics_daily_stats',
    'discord_analytics_anomaly_events', 'discord_analytics_stat_roles', 'discord_analytics_counters',
    'discord_analytics_audit_log'
  ] loop
    execute format('drop policy if exists discord_analytics_server_only on public.%I', table_name);
    execute format('create policy discord_analytics_server_only on public.%I as restrictive for all to public using (false) with check (false)', table_name);
  end loop;
end;
$$;
