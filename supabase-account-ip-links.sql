-- Account/IP association ledger for authenticated site traffic.
-- Run once in the HaloCheats Supabase project before enabling the deployed
-- server. The table has RLS enabled with no client policies: only the
-- server's Supabase service-role key can read or write these records.

create table if not exists public.account_ip_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_id text,
  ip_address text,
  ip_hash text not null,
  subnet_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, ip_hash)
);

create index if not exists account_ip_links_user_id_idx
  on public.account_ip_links (user_id);

create index if not exists account_ip_links_discord_id_idx
  on public.account_ip_links (discord_id);

create index if not exists account_ip_links_ip_hash_idx
  on public.account_ip_links (ip_hash);

create index if not exists account_ip_links_subnet_hash_idx
  on public.account_ip_links (subnet_hash);

alter table public.account_ip_links enable row level security;

-- Intentionally no RLS policies. This keeps IP records unavailable to anon or
-- authenticated client keys while allowing the server service role to manage
-- the ledger.
