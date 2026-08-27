-- Run once in the Supabase SQL editor.
-- Records the live supplier cost and payment amounts for each fulfillment so
-- profit reports do not have to guess from a percentage of the sale price.
create table if not exists public.order_fulfillment_costs (
  order_id uuid primary key references public.orders(id) on delete cascade,
  supplier text not null,
  supplier_cost_cents integer not null check (supplier_cost_cents >= 0),
  product_revenue_cents integer not null default 0 check (product_revenue_cents >= 0),
  processor_fee_cents integer not null default 0 check (processor_fee_cents >= 0),
  gross_charged_cents integer not null default 0 check (gross_charged_cents >= 0),
  net_proceeds_cents integer not null default 0 check (net_proceeds_cents >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_fulfillment_costs_supplier_idx
  on public.order_fulfillment_costs (supplier);

alter table public.order_fulfillment_costs enable row level security;
