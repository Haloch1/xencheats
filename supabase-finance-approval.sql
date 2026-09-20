-- Approval-mode metadata. This migration is intentionally additive and keeps
-- live execution disabled; tokens are stored inside the private decision JSON
-- and are only useful to owner-protected approval endpoints.
alter table public.finance_funding_plans
  add column if not exists approval_expires_at timestamptz,
  add column if not exists approval_invalidated_at timestamptz,
  add column if not exists approved_by text;

create index if not exists finance_funding_plans_approval_idx
  on public.finance_funding_plans (status, approval_expires_at);

revoke all on table public.finance_funding_plans from anon, authenticated;
drop policy if exists finance_private_deny_public on public.finance_funding_plans;
create policy finance_private_deny_public on public.finance_funding_plans
  for all to anon, authenticated using (false) with check (false);
