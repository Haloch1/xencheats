-- Durable supplier-attempt guard for paid-order recovery.
-- Run through Supabase migrations (service_role is the only runtime writer).
create table if not exists public.supplier_order_attempts (
  order_id uuid not null references public.orders(id) on delete cascade,
  supplier text not null,
  status text not null default 'started',
  supplier_order_id text,
  supplier_order_ref text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (order_id, supplier)
);

alter table public.supplier_order_attempts enable row level security;
revoke all on table public.supplier_order_attempts from anon, authenticated;
grant all on table public.supplier_order_attempts to service_role;

create index if not exists supplier_order_attempts_status_idx
  on public.supplier_order_attempts (status, updated_at);
