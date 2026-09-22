-- A paid funding plan may produce one verified capital batch, even if the
-- finance worker restarts or two instances observe the same supplier credit.
CREATE UNIQUE INDEX IF NOT EXISTS finance_one_batch_per_funding_plan
  ON public.finance_reinvestment_batches (funding_plan_id)
  WHERE funding_plan_id IS NOT NULL;
