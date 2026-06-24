create table if not exists public.admin_access_requests (
  id uuid primary key default gen_random_uuid(),
  request_token_hash text not null,
  staff_token_hash text not null,
  user_id uuid,
  user_email text,
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
  user_agent text
);

alter table public.admin_access_requests
  add column if not exists user_id uuid;

alter table public.admin_access_requests
  add column if not exists user_email text;

alter table public.admin_access_requests
  drop column if exists ip_address;

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
  user_agent text
);

alter table public.admin_audit_logs
  drop column if exists ip_address;

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

create table if not exists public.admin_delete_approvals (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  staff_request_id uuid references public.admin_access_requests(id) on delete set null,
  staff_discord_username text not null,
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'used', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  user_agent text
);

alter table public.admin_delete_approvals
  drop column if exists ip_address;

create index if not exists admin_delete_approvals_thread_staff_idx
  on public.admin_delete_approvals (thread_id, staff_request_id, status, created_at desc);

create index if not exists admin_delete_approvals_token_hash_idx
  on public.admin_delete_approvals (token_hash);
