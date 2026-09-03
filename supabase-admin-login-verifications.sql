-- Per-Supabase-session owner approval for the admin control center.
create table if not exists public.admin_login_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'expired')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  approved_by text,
  discord_channel_id text not null,
  discord_message_id text,
  ip_address text,
  user_agent text
);

create unique index if not exists admin_login_verifications_user_session_idx
  on public.admin_login_verifications (user_id, session_id);

create index if not exists admin_login_verifications_pending_expiry_idx
  on public.admin_login_verifications (status, expires_at);

alter table public.admin_login_verifications enable row level security;
revoke all on table public.admin_login_verifications from anon, authenticated;
