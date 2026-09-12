-- ============================================================================
-- Harden function grants and search_path
--
-- Found by Supabase's own security advisor against the real project, and NOT
-- catchable locally: PGlite has no `anon` role, so the default PUBLIC grant
-- never showed up in the test suite.
--
-- Postgres grants EXECUTE to PUBLIC on every new function. Our earlier
-- `grant ... to authenticated` added to that instead of replacing it, so anon
-- could reach every RPC. The write functions refuse an anonymous caller anyway,
-- but storage_path_org leaked which organisation a user id belongs to, and none
-- of them have any business being reachable without a session.
-- ============================================================================

revoke execute on function submit_inspection(jsonb, jsonb) from public, anon;
revoke execute on function approve_inspection(uuid, text) from public, anon;
revoke execute on function record_photo(uuid, uuid, uuid, text) from public, anon;
revoke execute on function current_org() from public, anon;
revoke execute on function current_role_name() from public, anon;
revoke execute on function storage_path_org(text) from public, anon;

-- `authenticated` still needs these: a policy expression runs with the
-- privileges of the querying role, so revoking them would break RLS itself.
grant execute on function submit_inspection(jsonb, jsonb) to authenticated;
grant execute on function approve_inspection(uuid, text) to authenticated;
grant execute on function record_photo(uuid, uuid, uuid, text) to authenticated;
grant execute on function current_org() to authenticated;
grant execute on function current_role_name() to authenticated;
grant execute on function storage_path_org(text) to authenticated;

-- Pin the search_path on the trigger functions. They are SECURITY INVOKER, so
-- the exposure is smaller, but a mutable search_path in a function that guards
-- a legal document is not a risk worth carrying for three lines of SQL.
alter function enforce_inspection_immutable() set search_path = public;
alter function enforce_answer_immutable() set search_path = public;
alter function enforce_photo_immutable() set search_path = public;
