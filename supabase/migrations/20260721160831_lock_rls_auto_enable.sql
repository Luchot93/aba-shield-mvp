-- ACD-51: Lock down rls_auto_enable() SECURITY DEFINER function.
-- Revoke EXECUTE from browser-facing roles + PUBLIC so it can no longer be
-- called via /rest/v1/rpc/. The active `ensure_rls` event trigger fires
-- independently of these grants, so auto-RLS behavior is unchanged.
-- service_role retained for backend use.
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.rls_auto_enable() from public;
