-- Encrypted Coinbase OAuth token storage. Values are ciphertext only; the
-- application keeps the encryption key in COINBASE_OAUTH_ENCRYPTION_KEY.
-- Service-role code is the only code path that reads this table.
create table if not exists public.finance_coinbase_oauth_tokens (
  id smallint primary key default 1 check (id = 1),
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  scope text[] not null default '{}',
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.finance_coinbase_oauth_tokens enable row level security;
revoke all on table public.finance_coinbase_oauth_tokens from anon, authenticated;
drop policy if exists finance_coinbase_oauth_private on public.finance_coinbase_oauth_tokens;
create policy finance_coinbase_oauth_private
  on public.finance_coinbase_oauth_tokens
  for all to anon, authenticated
  using (false)
  with check (false);
