-- Private, idempotent records for one free one-day product per earned
-- five-order / $30 milestone. Browser clients never access this table.
create table if not exists public.loyalty_product_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone integer not null check (milestone > 0),
  inventory_slug text not null,
  variant_slug text not null,
  status text not null check (status in (
    'processing',
    'pending',
    'completed',
    'failed',
    'reconciliation_required'
  )),
  supplier_dispatch_started boolean not null default false,
  error_code text,
  order_id uuid unique references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, milestone)
);

create index if not exists loyalty_product_redemptions_user_status_idx
  on public.loyalty_product_redemptions (user_id, status);

alter table public.loyalty_product_redemptions enable row level security;
revoke all on table public.loyalty_product_redemptions from anon, authenticated;
grant all on table public.loyalty_product_redemptions to service_role;
