-- ============================================================================
-- Storage: signatures and evidence
--
-- Both private. The paths the client writes are
--   signatures/{uploader_id}/{inspection_id}/declared.png
--   evidence/{uploader_id}/{inspection_id}/{photo_id}.jpg
--
-- so the first folder is the uploader. Writing is restricted to your own
-- folder; reading is allowed to anyone in the uploader's organisation, which
-- is how a supervisor sees the evidence without being able to plant any.
--
-- There is no DELETE policy on purpose: a signature and its evidence are part
-- of a signed document.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('signatures', 'signatures', false, 2097152, array['image/png']),
  ('evidence',   'evidence',   false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Helper: the organisation that owns a path, derived from its first folder.
create function storage_path_org(object_name text) returns uuid
  language sql stable security definer set search_path = public as $$
  select p.org_id
    from profiles p
   where p.id::text = (storage.foldername(object_name))[1]
$$;

grant execute on function storage_path_org(text) to authenticated;

-- Upload into your own folder only.
create policy "upload own signatures" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "upload own evidence" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Overwrite your own file, so a retry after a lost acknowledgement is safe.
create policy "replace own signatures" on storage.objects for update to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "replace own evidence" on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- Read anything uploaded by somebody in your organisation.
create policy "read signatures of my organisation" on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and storage_path_org(name) = current_org());

create policy "read evidence of my organisation" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and storage_path_org(name) = current_org());
