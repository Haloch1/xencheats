-- Keep historical media claims auditable while correcting allowance usage for
-- legacy panel claims that were duplicated during the website migration.
alter table public.media_campaigns
  add column if not exists counts_toward_allowance boolean not null default true;

-- These claims remain claimed in the audit and financial history. They no
-- longer consume the member's allowance because the website claims represent
-- the two keys that should count during the current rolling week.
update public.media_campaigns
set counts_toward_allowance = false
where discord_id = '1513671132052717749'
  and proof_platform = 'discord-media-panel'
  and status = 'claimed';
