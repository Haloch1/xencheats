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
  claim_status text not null default 'fulfilled',
  claimed_at timestamptz not null default now(),
  owner_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
