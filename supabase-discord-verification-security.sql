-- Run once in Supabase SQL Editor before enabling
-- DISCORD_VERIFICATION_REQUIRE_SECURITY_TABLES=true on Render.
-- Raw IP addresses never enter these tables; the app stores HMAC hashes only.

create table if not exists public.discord_verification_ips (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  ip_hash text not null,
  proxy_detected boolean not null default false,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  unique (discord_id, ip_hash)
);

create index if not exists discord_verification_ips_ip_hash_idx
  on public.discord_verification_ips (ip_hash);

create index if not exists discord_verification_ips_discord_id_idx
  on public.discord_verification_ips (discord_id);

create table if not exists public.discord_verification_ip_bans (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null unique,
  reason text not null default 'Blocked by staff',
  created_by text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists discord_verification_ip_bans_active_idx
  on public.discord_verification_ip_bans (ip_hash, expires_at);

alter table public.discord_verification_ips enable row level security;
alter table public.discord_verification_ip_bans enable row level security;

-- Intentionally no RLS policies: only the server's Supabase service-role key
-- may read or write verification security data.
