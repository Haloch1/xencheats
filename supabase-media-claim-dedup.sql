create table if not exists public.media_claim_dedup_guard (
  discord_id text not null,
  product_slug text not null,
  variant_key text not null,
  campaign_id uuid not null,
  status text not null check (status in ('reserved', 'dispatching', 'uncertain', 'claimed')),
  reserved_at timestamptz not null default now(),
  claimed_at timestamptz,
  cooldown_until timestamptz,
  primary key (discord_id, product_slug, variant_key)
);

create unique index if not exists media_claim_dedup_guard_campaign_id_uidx
  on public.media_claim_dedup_guard (campaign_id);

alter table public.media_claim_dedup_guard enable row level security;
revoke all on table public.media_claim_dedup_guard from anon, authenticated;
grant all on table public.media_claim_dedup_guard to service_role;

insert into public.media_claim_dedup_guard (
  discord_id, product_slug, variant_key, campaign_id, status, reserved_at, claimed_at, cooldown_until
)
select distinct on (discord_id, product_slug, lower(btrim(variant_label)))
  discord_id,
  product_slug,
  lower(btrim(variant_label)),
  id,
  'claimed',
  claimed_at,
  claimed_at,
  claimed_at + interval '24 hours'
from public.media_campaigns
where status = 'claimed'
  and claimed_at >= now() - interval '24 hours'
  and nullif(btrim(discord_id), '') is not null
  and nullif(btrim(product_slug), '') is not null
  and nullif(btrim(variant_label), '') is not null
order by discord_id, product_slug, lower(btrim(variant_label)), claimed_at desc
on conflict (discord_id, product_slug, variant_key) do update
set campaign_id = excluded.campaign_id,
    status = 'claimed',
    reserved_at = excluded.reserved_at,
    claimed_at = excluded.claimed_at,
    cooldown_until = excluded.cooldown_until
where public.media_claim_dedup_guard.status <> 'reserved'
  and public.media_claim_dedup_guard.claimed_at < excluded.claimed_at;

create or replace function public.reserve_media_claim_dedup(
  p_discord_id text,
  p_product_slug text,
  p_variant_key text,
  p_campaign_id uuid
)
returns table(acquired boolean, lock_status text, retry_after timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_acquired boolean := false;
  v_status text;
  v_cooldown timestamptz;
begin
  insert into public.media_claim_dedup_guard (
    discord_id, product_slug, variant_key, campaign_id, status, reserved_at
  )
  values (
    p_discord_id, p_product_slug, lower(btrim(p_variant_key)), p_campaign_id, 'reserved', now()
  )
  on conflict (discord_id, product_slug, variant_key) do update
  set campaign_id = excluded.campaign_id,
      status = 'reserved',
      reserved_at = now(),
      claimed_at = null,
      cooldown_until = null
  where public.media_claim_dedup_guard.status = 'claimed'
    and public.media_claim_dedup_guard.cooldown_until <= now()
  returning true into v_acquired;

  if coalesce(v_acquired, false) then
    return query select true, 'reserved'::text, null::timestamptz;
    return;
  end if;

  select guard.status, guard.cooldown_until
    into v_status, v_cooldown
  from public.media_claim_dedup_guard as guard
  where guard.discord_id = p_discord_id
    and guard.product_slug = p_product_slug
    and guard.variant_key = lower(btrim(p_variant_key));

  return query select false, coalesce(v_status, 'in_progress'), v_cooldown;
end;
$$;

create or replace function public.release_media_claim_dedup(p_campaign_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_deleted boolean := false;
begin
  delete from public.media_claim_dedup_guard
  where campaign_id = p_campaign_id
    and status in ('reserved', 'dispatching')
  returning true into v_deleted;
  return coalesce(v_deleted, false);
end;
$$;

revoke all on function public.reserve_media_claim_dedup(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.release_media_claim_dedup(uuid) from public, anon, authenticated;
grant execute on function public.reserve_media_claim_dedup(text, text, text, uuid) to service_role;
grant execute on function public.release_media_claim_dedup(uuid) to service_role;
