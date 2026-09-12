-- ============================================================================
-- Move the internal helpers out of the exposed schema
--
-- current_org / current_role_name / storage_path_org are used inside policies.
-- Living in `public` made them REST endpoints, and storage_path_org let any
-- signed-in user map a user id to its organisation — across organisations.
--
-- PostgREST only exposes `public`, so a private schema removes the endpoint
-- while policies keep working. The three RPCs the app genuinely calls stay
-- where they are.
-- ============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.current_org() returns uuid
  language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create function private.current_role_name() returns public.user_role
  language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function private.storage_path_org(object_name text) returns uuid
  language sql stable security definer set search_path = public as $$
  select p.org_id
    from public.profiles p
   where p.id::text = (storage.foldername(object_name))[1]
$$;

revoke execute on function private.current_org() from public, anon;
revoke execute on function private.current_role_name() from public, anon;
revoke execute on function private.storage_path_org(text) from public, anon;
grant execute on function private.current_org() to authenticated;
grant execute on function private.current_role_name() to authenticated;
grant execute on function private.storage_path_org(text) to authenticated;

drop policy profiles_read_org on profiles;
create policy profiles_read_org on profiles for select
  using (org_id = private.current_org());

drop policy templates_read_org on templates;
create policy templates_read_org on templates for select
  using (org_id = private.current_org());

drop policy sections_read_org on template_sections;
create policy sections_read_org on template_sections for select
  using (exists (select 1 from templates t where t.id = template_id and t.org_id = private.current_org()));

drop policy items_read_org on template_items;
create policy items_read_org on template_items for select
  using (exists (
    select 1 from template_sections s
    join templates t on t.id = s.template_id
    where s.id = section_id and t.org_id = private.current_org()
  ));

drop policy inspections_read_org on inspections;
create policy inspections_read_org on inspections for select
  using (org_id = private.current_org());

drop policy answers_read_org on answers;
create policy answers_read_org on answers for select
  using (exists (select 1 from inspections i where i.id = inspection_id and i.org_id = private.current_org()));

drop policy photos_read_org on answer_photos;
create policy photos_read_org on answer_photos for select
  using (exists (select 1 from inspections i where i.id = inspection_id and i.org_id = private.current_org()));

drop policy "read signatures of my organisation" on storage.objects;
create policy "read signatures of my organisation" on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and private.storage_path_org(name) = private.current_org());

drop policy "read evidence of my organisation" on storage.objects;
create policy "read evidence of my organisation" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and private.storage_path_org(name) = private.current_org());

create or replace function submit_inspection(p_inspection jsonb, p_answers jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := private.current_org();
  v_id  uuid := (p_inspection ->> 'id')::uuid;
begin
  if v_uid is null or v_org is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_id is null then
    raise exception 'inspection id is required' using errcode = '22004';
  end if;

  insert into inspections (
    id, org_id, template_id, template_version,
    vehicle_type, plate, brand, model, year, driver_name, odometer_km, inspected_at,
    general_observations,
    declared_by_name, declared_by_role, declared_signature_path, declared_at,
    status, created_by
  )
  values (
    v_id, v_org,
    (p_inspection ->> 'template_id')::uuid,
    (p_inspection ->> 'template_version')::int,
    p_inspection ->> 'vehicle_type',
    upper(trim(p_inspection ->> 'plate')),
    p_inspection ->> 'brand',
    p_inspection ->> 'model',
    nullif(p_inspection ->> 'year', '')::int,
    p_inspection ->> 'driver_name',
    nullif(p_inspection ->> 'odometer_km', '')::int,
    (p_inspection ->> 'inspected_at')::timestamptz,
    p_inspection ->> 'general_observations',
    p_inspection ->> 'declared_by_name',
    p_inspection ->> 'declared_by_role',
    p_inspection ->> 'declared_signature_path',
    (p_inspection ->> 'declared_at')::timestamptz,
    'submitted', v_uid
  )
  on conflict (id) do nothing;

  insert into answers (inspection_id, item_id, value, observation, responsible, due_date)
  select
    v_id,
    (a ->> 'item_id')::uuid,
    (a ->> 'value')::answer_val,
    a ->> 'observation',
    a ->> 'responsible',
    nullif(a ->> 'due_date', '')::date
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as a
  on conflict (inspection_id, item_id) do nothing;

  return v_id;
end $$;

create or replace function approve_inspection(p_id uuid, p_signature_path text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := private.current_org();
  v_author uuid;
  v_updated int;
begin
  if private.current_role_name() <> 'supervisor' then
    raise exception 'only a supervisor can approve an inspection' using errcode = '42501';
  end if;

  select created_by into v_author
    from inspections
   where id = p_id and org_id = v_org;

  if v_author = v_uid then
    raise exception 'an inspection cannot be approved by the person who declared it'
      using errcode = '42501';
  end if;

  update inspections
     set approved_by = v_uid,
         approved_signature_path = p_signature_path,
         approved_at = now(),
         status = 'approved',
         updated_at = now()
   where id = p_id
     and org_id = v_org
     and status = 'submitted';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'inspection not found, not yours, or already approved' using errcode = 'P0002';
  end if;
end $$;

create or replace function record_photo(
  p_id uuid, p_inspection_id uuid, p_item_id uuid, p_storage_path text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := private.current_org();
begin
  if v_org is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from inspections i where i.id = p_inspection_id and i.org_id = v_org
  ) then
    raise exception 'inspection not found in your organisation' using errcode = 'P0002';
  end if;

  insert into answer_photos (id, inspection_id, item_id, storage_path)
  values (p_id, p_inspection_id, p_item_id, p_storage_path)
  on conflict (id) do nothing;
end $$;

drop function public.current_org();
drop function public.current_role_name();
drop function public.storage_path_org(text);
