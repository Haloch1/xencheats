create or replace function public.mark_media_claim_dispatching(p_campaign_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_updated boolean := false;
begin
  update public.media_claim_dedup_guard
  set status = 'dispatching'
  where campaign_id = p_campaign_id
    and status = 'reserved'
  returning true into v_updated;
  return coalesce(v_updated, false);
end;
$$;

create or replace function public.complete_media_claim_dedup(p_campaign_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_updated boolean := false;
begin
  update public.media_claim_dedup_guard
  set status = 'claimed',
      claimed_at = now(),
      cooldown_until = now() + interval '24 hours'
  where campaign_id = p_campaign_id
    and status in ('reserved', 'dispatching')
  returning true into v_updated;
  return coalesce(v_updated, false);
end;
$$;

create or replace function public.mark_media_claim_uncertain(p_campaign_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_updated boolean := false;
begin
  update public.media_claim_dedup_guard
  set status = 'uncertain',
      cooldown_until = null
  where campaign_id = p_campaign_id
    and status in ('reserved', 'dispatching')
  returning true into v_updated;
  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.mark_media_claim_dispatching(uuid) from public, anon, authenticated;
revoke all on function public.complete_media_claim_dedup(uuid) from public, anon, authenticated;
revoke all on function public.mark_media_claim_uncertain(uuid) from public, anon, authenticated;
grant execute on function public.mark_media_claim_dispatching(uuid) to service_role;
grant execute on function public.complete_media_claim_dedup(uuid) to service_role;
grant execute on function public.mark_media_claim_uncertain(uuid) to service_role;
