-- Legacy key audit rows include exact license values and customer/order IDs.
-- Only the server may read them. RLS is already enabled on this table, but its
-- legacy SELECT policy allows every row; remove client privileges as well.
-- No storefront client references this table. Service-role access is preserved.
begin;
revoke all on table public.key_audit_log from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.key_audit_log', 'SELECT')
     or has_table_privilege('authenticated', 'public.key_audit_log', 'SELECT') then
    raise exception 'Key audit log remains accessible to clients';
  end if;
  if not has_table_privilege('service_role', 'public.key_audit_log', 'SELECT')
     or not has_table_privilege('service_role', 'public.key_audit_log', 'INSERT') then
    raise exception 'Server key audit access must be preserved';
  end if;
end $$;
commit;

-- Rollback, if ever required: the prior client grants were
-- grant select, insert, update, delete on public.key_audit_log to anon, authenticated;
-- Restoring those grants re-exposes license values through the legacy policy.
