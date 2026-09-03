-- Guest card checkout support.
-- Run once in the Supabase SQL editor. Guest orders remain attached to their
-- Stripe session and an expiring server-held token; balance checkout stays
-- account-only.

alter table public.orders
  alter column user_id drop not null;

alter table public.orders
  add column if not exists guest_email text,
  add column if not exists guest_access_token_hash text,
  add column if not exists guest_access_token_expires_at timestamptz;

create unique index if not exists orders_guest_access_token_hash_idx
  on public.orders (guest_access_token_hash)
  where guest_access_token_hash is not null;

create index if not exists orders_guest_email_idx
  on public.orders (guest_email)
  where guest_email is not null;
