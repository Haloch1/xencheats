-- Per-member media claim overrides. NULL uses the server default (4/week).
alter table public.media_members
  add column if not exists weekly_claim_limit integer
  check (weekly_claim_limit is null or weekly_claim_limit >= 0);

-- Member-specific allowance requested by the owner.
update public.media_members
set weekly_claim_limit = 5
where discord_id = '1513671132052717749';
