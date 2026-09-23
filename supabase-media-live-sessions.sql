-- Durable TikTok LIVE observations. Only the server service role may access these rows.
create table if not exists public.media_live_sessions (
  id bigint generated always as identity primary key,
  source_message_id text not null unique,
  source_channel_id text not null,
  member_discord_id text not null,
  member_username text,
  content_db_id bigint references public.media_content(id) on delete set null,
  live_url text not null,
  handle text not null,
  room_id text,
  status text not null default 'pending' check (status in ('pending','live','ended','unavailable')),
  posted_at timestamptz not null,
  started_at timestamptz,
  first_live_at timestamptz,
  last_live_at timestamptz,
  first_offline_at timestamptz,
  offline_checks integer not null default 0,
  ended_at timestamptz,
  result_message_id text,
  next_check_at timestamptz not null default now(),
  failure_count integer not null default 0,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_live_sessions_due_idx on public.media_live_sessions(next_check_at) where status in ('pending','live','ended');
create index if not exists media_live_sessions_member_idx on public.media_live_sessions(member_discord_id, created_at desc);
alter table public.media_live_sessions enable row level security;
revoke all on public.media_live_sessions from anon, authenticated;
grant select, insert, update on public.media_live_sessions to service_role;
grant usage, select on sequence public.media_live_sessions_id_seq to service_role;
