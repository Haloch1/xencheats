-- Media campaign credits. Run once in the Supabase SQL editor.
-- The server uses the service-role client; RLS is enabled so browser clients
-- cannot read or mutate media credits directly.

create table if not exists media_campaigns (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  product_slug text not null,
  variant_label text not null,
  proof_url text not null,
  proof_platform text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'claimed', 'expired', 'cancelled')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewer_discord_id text,
  reviewer_note text,
  credit_expires_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  claimed_at timestamptz
);
create index if not exists media_campaigns_discord_idx on media_campaigns (discord_id, created_at desc);
create index if not exists media_campaigns_status_idx on media_campaigns (status, created_at desc);

create table if not exists media_credits (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references media_campaigns(id) on delete cascade,
  discord_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  product_slug text not null,
  variant_label text not null,
  status text not null default 'available' check (status in ('available', 'claimed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists media_credits_discord_idx on media_credits (discord_id, created_at desc);
create unique index if not exists media_credits_one_active_per_member_idx
  on media_credits (discord_id) where status in ('available', 'claimed');

create table if not exists media_credit_audit_logs (
  id bigserial primary key,
  credit_id uuid references media_credits(id) on delete set null,
  campaign_id uuid references media_campaigns(id) on delete set null,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_discord_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists media_credit_audit_created_idx on media_credit_audit_logs (created_at desc);

alter table media_campaigns enable row level security;
alter table media_credits enable row level security;
alter table media_credit_audit_logs enable row level security;

-- Atomically reserve one local key. This prevents two simultaneous media
-- claims from receiving the same key.
create or replace function claim_media_license_key(
  p_product_slug text,
  p_user_id uuid,
  p_order_id uuid
) returns table (id uuid, key_value text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update license_keys as lk
  set status = 'assigned',
      assigned_user_id = p_user_id,
      assigned_order_id = p_order_id,
      assigned_at = now()
  where lk.id = (
    select candidate.id
    from license_keys as candidate
    where candidate.product_slug = p_product_slug
      and candidate.status = 'unused'
    order by candidate.created_at asc
    for update skip locked
    limit 1
  )
  returning lk.id, lk.key_value;
end;
$$;
