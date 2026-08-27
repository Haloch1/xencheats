-- Persistent baseline for the local-license-key restock watcher.
-- This prevents a deployment from forgetting the previous stock counts and
-- treating the first post-deploy check as a new restock.
create table if not exists public.restock_stock_state (
  inventory_slug text primary key,
  stock_count integer not null default 0 check (stock_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.restock_stock_state enable row level security;
