-- Browser review submissions use /api/reviews, which verifies a fulfilled
-- purchase and moderates the text. Direct Data API inserts bypass both checks
-- and let the caller choose status='approved'. Keep reads and server writes.
begin;
revoke insert on table public.reviews from anon, authenticated;
do $$
begin
  if has_table_privilege('anon', 'public.reviews', 'INSERT')
     or has_table_privilege('authenticated', 'public.reviews', 'INSERT') then
    raise exception 'Direct review submission remains enabled';
  end if;
  if not has_table_privilege('anon', 'public.reviews', 'SELECT')
     or not has_table_privilege('service_role', 'public.reviews', 'INSERT') then
    raise exception 'Public review reads and server submissions must be preserved';
  end if;
end $$;
commit;
-- Prior INSERT grants can be restored with:
-- grant insert on public.reviews to anon, authenticated;
