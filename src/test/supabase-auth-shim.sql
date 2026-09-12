-- Stand-in for what Supabase provides, so the real migrations can run locally.
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

-- Supabase's roles. RLS applies to `authenticated` because it is not the owner.
create role authenticated nologin;
create role anon nologin;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

-- Minimal Storage, enough for the bucket and policy migrations to apply.
-- The real behaviour is verified against the actual project, not here; what
-- this catches is SQL that would fail on deploy.
create schema if not exists storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets,
  name text not null,
  owner uuid,
  metadata jsonb
);

alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
  language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema storage to authenticated;
grant select, insert, update on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
