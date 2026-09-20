-- Additive state and operator metadata for the simulation-only Windows bridge.
do $$
begin
  alter table public.finance_funding_plans drop constraint if exists finance_funding_plans_status_check;
  alter table public.finance_funding_plans add constraint finance_funding_plans_status_check check (status in (
    'proposed','blocked','ready','awaiting_approval','approved','operator_starting',
    'coinbase_open','reviewing','submitting','submitted','onchain_pending',
    'onchain_confirmed','supplier_pending','completed','simulation_complete',
    'rejected','expired','needs_owner_action','cancelled','failed','cancelled_revalidation'
  ));
exception when duplicate_object then null;
end $$;

alter table public.finance_funding_plans
  add column if not exists operator_id text,
  add column if not exists operator_claimed_at timestamptz,
  add column if not exists operator_started_at timestamptz,
  add column if not exists operator_updated_at timestamptz,
  add column if not exists operator_last_error text,
  add column if not exists coinbase_transaction_id text,
  add column if not exists coinbase_transaction_hash text,
  add column if not exists coinbase_submitted_at timestamptz;

create index if not exists finance_funding_plans_operator_claim_idx
  on public.finance_funding_plans (status, operator_claimed_at, created_at);
create index if not exists finance_funding_plans_operator_id_idx
  on public.finance_funding_plans (operator_id, operator_updated_at desc);

revoke all on table public.finance_funding_plans from anon, authenticated;
drop policy if exists finance_private_deny_public on public.finance_funding_plans;
create policy finance_private_deny_public on public.finance_funding_plans
  for all to anon, authenticated using (false) with check (false);
