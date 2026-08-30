-- Already applied directly to the live Supabase project (2026-08-29) via the
-- Supabase MCP migration tool. Kept here for history/reference and for
-- reproducing on a fresh project, same as the other supabase-*.sql files.
--
-- Lets staff record what a manually-imported/stocked license key actually
-- cost, so orders fulfilled from local stock (no live supplier route) can
-- get a real order_fulfillment_costs row instead of showing "Unavailable"
-- forever on the admin Overview dashboard.
alter table public.license_keys
  add column if not exists cost_cents integer;

alter table public.license_keys
  drop constraint if exists license_keys_cost_cents_check;

alter table public.license_keys
  add constraint license_keys_cost_cents_check check (cost_cents is null or cost_cents >= 0);
