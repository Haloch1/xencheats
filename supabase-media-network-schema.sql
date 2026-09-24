-- Media Network schema. Run this once in the Supabase SQL editor.
-- Matches the project's existing pattern of standalone .sql files run manually
-- (see supabase-admin-security.sql, supabase-discord-verification-security.sql).

-- ── Media members: one row per Discord member who has ever held the Media role ──
create table if not exists media_members (
  id bigserial primary key,
  discord_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  username text,
  channel_id text,
  status text not null default 'active' check (status in ('active', 'paused', 'under_review', 'removed')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_reason text,
  status_changed_by text,
  status_changed_at timestamptz,
  -- Null uses the server default; owner access is handled separately.
  weekly_claim_limit integer check (weekly_claim_limit is null or weekly_claim_limit >= 0)
);
create index if not exists media_members_discord_id_idx on media_members (discord_id);
create index if not exists media_members_status_idx on media_members (status);

alter table public.media_members
  add column if not exists weekly_claim_limit integer
  check (weekly_claim_limit is null or weekly_claim_limit >= 0);

-- ── Submitted media content ──
create table if not exists media_content (
  id bigserial primary key,
  content_id text unique, -- e.g. MEDIA-0042, filled in after insert from the bigserial id
  submitter_discord_id text not null,
  submitter_username text,
  video_url text,
  game text not null,
  caption text not null,
  hashtags text[] not null default '{}',
  creator_credit text not null,
  campaign text,
  notes text,
  redistributable boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  review_channel_message_id text,
  distributed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_content_status_idx on media_content (status);
create index if not exists media_content_submitter_idx on media_content (submitter_discord_id);
create index if not exists media_content_campaign_idx on media_content (campaign);

-- Audit trail: every review action (approve/reject/request changes/edit/flag) is
-- logged here rather than only keeping the latest status on media_content.
create table if not exists media_content_reviews (
  id bigserial primary key,
  content_id bigint not null references media_content(id) on delete cascade,
  reviewer_discord_id text not null,
  reviewer_username text,
  decision text not null, -- approved / rejected / changes_requested / edited / not_redistributable
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists media_content_reviews_content_idx on media_content_reviews (content_id);

-- ── Reported reposts ──
create table if not exists media_posts (
  id bigserial primary key,
  content_db_id bigint not null references media_content(id) on delete cascade,
  content_id text not null, -- denormalized MEDIA-xxxx for easy lookup/display
  member_discord_id text not null,
  member_username text,
  platform text not null,
  link text not null,
  campaign text,
  status text not null default 'pending_verification' check (status in ('pending_verification', 'approved', 'rejected', 'flagged', 'needs_correction')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_posts_content_idx on media_posts (content_db_id);
create index if not exists media_posts_member_idx on media_posts (member_discord_id);
create index if not exists media_posts_status_idx on media_posts (status);
-- Prevents the same member reporting the same content on the same platform twice
-- at the database layer. Application code allows an employee override by deleting
-- the prior row first when they explicitly approve a duplicate.
create unique index if not exists media_posts_unique_member_content_platform
  on media_posts (content_db_id, member_discord_id, lower(platform));

-- Verification audit trail for reported post links.
create table if not exists media_post_reviews (
  id bigserial primary key,
  post_id bigint not null references media_posts(id) on delete cascade,
  reviewer_discord_id text not null,
  reviewer_username text,
  decision text not null, -- approved / rejected / flagged / needs_correction
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists media_post_reviews_post_idx on media_post_reviews (post_id);
