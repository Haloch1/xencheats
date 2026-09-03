/* Owner-controlled supplier-wide storefront switches.
   The server uses the service-role client; public roles must not read or
   change these controls. */
create table if not exists public.supplier_availability (
  supplier text primary key check (supplier in ('rft', 'cheatslove', 'ghostware')),
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.supplier_availability (supplier, available)
values
  ('rft', true),
  ('cheatslove', true),
  ('ghostware', false)
on conflict (supplier) do nothing;

alter table public.supplier_availability enable row level security;
revoke all on table public.supplier_availability from anon, authenticated;
