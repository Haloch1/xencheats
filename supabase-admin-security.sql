create table if not exists public.admin_access_requests (
  id uuid primary key default gen_random_uuid(),
  request_token_hash text not null,
  staff_token_hash text not null,
  discord_username text not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  denied_at timestamptz,
  denied_by text,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text
);

create index if not exists admin_access_requests_status_idx
  on public.admin_access_requests (status, requested_at desc);

create index if not exists admin_access_requests_staff_token_hash_idx
  on public.admin_access_requests (staff_token_hash);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_type text not null,
  target_id text not null,
  actor_request_id uuid references public.admin_access_requests(id) on delete set null,
  actor_discord_username text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);
