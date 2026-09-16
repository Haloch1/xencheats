-- The per-supplier primary key does not stop different suppliers from both
-- purchasing for the same order during overlapping deployments. Hold one
-- creation slot per order until a provider explicitly rejects the purchase.
-- Apply after the server keeps uncertain outcomes in status='started'.
begin;
create unique index if not exists supplier_order_attempts_one_creation_idx
  on public.supplier_order_attempts (order_id)
  where status in ('started', 'accepted', 'completed');
do $$
begin
  if not exists (
    select 1 from pg_index
    where indexrelid = 'public.supplier_order_attempts_one_creation_idx'::regclass
      and indisunique and indisvalid
  ) then
    raise exception 'Supplier order creation guard must be valid and unique';
  end if;
end $$;
commit;
-- Reversible without editing any order/attempt row:
-- drop index public.supplier_order_attempts_one_creation_idx;
