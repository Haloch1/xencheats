-- Preserve an uncertain Coinbase Send as a non-retryable funding-plan state.
begin;
alter table public.finance_funding_plans
  drop constraint if exists finance_funding_plans_status_check;
alter table public.finance_funding_plans
  add constraint finance_funding_plans_status_check check (status in (
    'proposed','blocked','ready','awaiting_approval','approved','operator_starting',
    'coinbase_open','reviewing','submitting','submitted','onchain_pending',
    'onchain_confirmed','supplier_pending','completed','simulation_complete',
    'rejected','expired','needs_owner_action','cancelled','failed',
    'cancelled_revalidation','reconciliation_required'
  ));
-- Concurrent /reinvest requests cannot create two payable approval plans.
create unique index if not exists finance_one_active_real_cheatslove_plan
  on public.finance_funding_plans (supplier)
  where supplier = 'cheatslove' and simulation = false and status in (
    'awaiting_approval','approved','operator_starting','coinbase_open','reviewing',
    'submitting','submitted','onchain_pending','onchain_confirmed',
    'supplier_pending','reconciliation_required'
  );
commit;
