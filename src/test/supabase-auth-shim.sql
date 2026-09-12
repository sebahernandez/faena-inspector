-- Stand-in for what Supabase provides, so the real migration can run locally.
-- Production never sees this file.
create schema if not exists auth;

create table auth.users (
  id uuid primary key,
  email text
);

create function auth.uid() returns uuid
  language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Supabase's role for a signed-in user. RLS applies because it is not the owner.
create role authenticated nologin;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
