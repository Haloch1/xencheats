-- Already applied directly to the live Supabase project (2026-08-30) via the
-- Supabase MCP migration tool. Kept here for history/reference and for
-- reproducing on a fresh project, same as the other supabase-*.sql files.
--
-- Persistent state for the automatic media-claim gate: pauses new media key
-- claims (both the website panel and the Discord media panel) once media has
-- taken as many or more of the shared-stock 1-day keys as real paying orders
-- have, and keeps it paused until real orders pull back ahead by the
-- configured reopen buffer (MEDIA_CLAIM_REOPEN_ORDER_BUFFER, default 15).
-- This is deliberate hysteresis so the gate does not flap open/closed on
-- every single alternating claim and order.
create table if not exists public.media_claim_gate_state (
  key text primary key,
  paused boolean not null default false,
  media_taken_count integer not null default 0,
  real_orders_count integer not null default 0,
  paused_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.media_claim_gate_state enable row level security;
