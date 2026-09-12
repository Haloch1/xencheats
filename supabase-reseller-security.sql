/* Lock reseller data to the server-side service role and provide atomic
   balance operations for the reseller purchase API. */
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'bot_admins',
    'bot_settings',
    'product_status_overrides',
    'resellers',
    'reseller_orders',
    'media_members',
    'media_content',
    'media_content_reviews',
    'media_posts',
    'media_post_reviews',
    'giveaways',
    'giveaway_entries',
    'giveaway_keys',
    'member_departures'
  ] loop
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create or replace function public.debit_reseller_balance(
  p_reseller_id uuid,
  p_amount_cents integer
)
returns table(balance_cents integer, lifetime_purchased_cents integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_reseller_debit_amount' using errcode = '22023';
  end if;

  return query
    update public.resellers as r
       set balance_cents = r.balance_cents - p_amount_cents,
           lifetime_purchased_cents = r.lifetime_purchased_cents + p_amount_cents,
           updated_at = now()
     where r.id = p_reseller_id
       and r.status = 'approved'
       and r.balance_cents >= p_amount_cents
     returning r.balance_cents, r.lifetime_purchased_cents;
end;
$$;

create or replace function public.refund_reseller_balance(
  p_reseller_id uuid,
  p_amount_cents integer
)
returns table(balance_cents integer, lifetime_purchased_cents integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_reseller_refund_amount' using errcode = '22023';
  end if;

  return query
    update public.resellers as r
       set balance_cents = r.balance_cents + p_amount_cents,
           lifetime_purchased_cents = greatest(0, r.lifetime_purchased_cents - p_amount_cents),
           updated_at = now()
     where r.id = p_reseller_id
     returning r.balance_cents, r.lifetime_purchased_cents;
end;
$$;

revoke all on function public.debit_reseller_balance(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_reseller_balance(uuid, integer) from public, anon, authenticated;
grant execute on function public.debit_reseller_balance(uuid, integer) to service_role;
grant execute on function public.refund_reseller_balance(uuid, integer) to service_role;

/* Harden existing analytics and key functions reported by Supabase's security
   advisor. The server calls these with the service-role client only. */
alter function public.get_funnel_summary(integer, integer) set search_path = public;
alter function public.get_funnel_exit_pages(integer, integer, integer) set search_path = public;
alter function public.get_checkout_abandonment(integer, integer) set search_path = public;
alter function public.get_churn_summary(integer) set search_path = public;
alter function public.get_churn_trend(integer) set search_path = public;
alter function public.xr_expire_keys() set search_path = public;
alter function public.xr_activate_key(text, text) set search_path = public;
alter function public.discord_analytics_preserve_first_activity() set search_path = public;

revoke all on function public.claim_media_license_key(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.xr_activate_key(text, text) from public, anon, authenticated;
revoke all on function public.xr_expire_keys() from public, anon, authenticated;
grant execute on function public.claim_media_license_key(text, uuid, uuid) to service_role;
grant execute on function public.xr_activate_key(text, text) to service_role;
grant execute on function public.xr_expire_keys() to service_role;
