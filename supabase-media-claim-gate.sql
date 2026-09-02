-- Already applied directly to the live Supabase project (2026-08-30) via the
-- Supabase MCP migration tool. Kept here for history/reference and for
-- reproducing on a fresh project, same as the other supabase-*.sql files.
--
-- Persistent state for the automatic media-claim gate. The server compares
-- the previous completed local day's confirmed media supplier cost with its
-- gross cash sales, then keeps that decision across deploys/restarts.
create table if not exists public.media_claim_gate_state (
  key text primary key,
  paused boolean not null default false,
  media_taken_count integer not null default 0,
  real_orders_count integer not null default 0,
  period_key text,
  media_cost_cents integer,
  cash_revenue_cents integer,
  decision_reason text,
  paused_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.media_claim_gate_state
  add column if not exists period_key text,
  add column if not exists media_cost_cents integer,
  add column if not exists cash_revenue_cents integer,
  add column if not exists decision_reason text;

alter table public.media_claim_gate_state enable row level security;
