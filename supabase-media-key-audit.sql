-- Owner-only media/key operations history. Run once in the Supabase SQL editor.
-- The server uses the service-role client; RLS keeps browser clients from
-- reading exact license keys or the identities attached to them.

create table if not exists public.media_key_claim_audit (
  id bigserial primary key,
  campaign_id uuid not null unique references public.media_campaigns(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  discord_id text not null,
  discord_username text,
  product_slug text not null,
  variant_label text,
  key_value text not null,
  supplier text not null,
  supplier_order_id text,
  supplier_order_ref text,
  supplier_cost_cents integer check (supplier_cost_cents is null or supplier_cost_cents >= 0),
  claim_status text not null default 'fulfilled',
  claimed_at timestamptz not null default now(),
  owner_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.media_key_claim_audit
  add column if not exists supplier_cost_cents integer
  check (supplier_cost_cents is null or supplier_cost_cents >= 0);

create index if not exists media_key_claim_audit_claimed_idx
  on public.media_key_claim_audit (claimed_at desc);
create index if not exists media_key_claim_audit_order_idx
  on public.media_key_claim_audit (order_id);
create index if not exists media_key_claim_audit_supplier_order_idx
  on public.media_key_claim_audit (supplier, supplier_order_id);

create table if not exists public.license_key_audit_events (
  id bigserial primary key,
  key_id text,
  key_value text not null,
  product_slug text,
  event_type text not null,
  actor_discord_id text,
  actor_username text,
  order_id uuid references public.orders(id) on delete set null,
  supplier text,
  supplier_order_id text,
  supplier_order_ref text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists license_key_audit_events_key_idx
  on public.license_key_audit_events (key_value, created_at desc);
create index if not exists license_key_audit_events_created_idx
  on public.license_key_audit_events (created_at desc);
create index if not exists license_key_audit_events_event_idx
  on public.license_key_audit_events (event_type, created_at desc);

alter table public.media_key_claim_audit enable row level security;
alter table public.license_key_audit_events enable row level security;

create table if not exists public.promo_code_audit_events (
  id bigserial primary key,
  code text not null,
  percent integer,
  action text not null,
  actor_discord_id text,
  actor_username text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists promo_code_audit_events_code_idx
  on public.promo_code_audit_events (code, created_at desc);
create index if not exists promo_code_audit_events_created_idx
  on public.promo_code_audit_events (created_at desc);

alter table public.promo_code_audit_events enable row level security;

-- Durable deduplication for the private exact-key delivery feed. The service
-- role posts the message once, even if the process restarts or a fulfillment
-- retry runs again.
create table if not exists public.key_delivery_channel_logs (
  delivery_ref text primary key,
  order_id uuid references public.orders(id) on delete set null,
  campaign_id uuid references public.media_campaigns(id) on delete set null,
  key_value text not null,
  product_slug text,
  recipient text,
  supplier text,
  amount_cents integer,
  channel_id text not null,
  posted_at timestamptz not null default now()
);

create index if not exists key_delivery_channel_logs_posted_idx
  on public.key_delivery_channel_logs (posted_at desc);
alter table public.key_delivery_channel_logs enable row level security;

-- Durable deduplication for repeated order-risk findings. A changed set of
-- reasons creates a new fingerprint and is reported once again.
create table if not exists public.order_risk_alerts (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  fingerprint text not null,
  reasons jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_reported_at timestamptz,
  resolved_at timestamptz,
  unique (order_id, fingerprint)
);

create index if not exists order_risk_alerts_reported_idx
  on public.order_risk_alerts (last_reported_at desc);
alter table public.order_risk_alerts enable row level security;
