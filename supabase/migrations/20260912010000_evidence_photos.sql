-- ============================================================================
-- Evidence photos
--
-- Same shape as everything else: no INSERT policy, writes go through one
-- function, and the row is immutable once written. A photo attached to a
-- signed inspection is part of that document.
-- ============================================================================

create function enforce_photo_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'evidence of a submitted inspection is immutable' using errcode = '42501';
end $$;

create trigger answer_photos_immutable
  before update or delete on answer_photos
  for each row execute function enforce_photo_immutable();

-- Loud refusal rather than a silent zero-row no-op. See the initial migration.
create policy photos_block_update on answer_photos for update using (true) with check (false);
create policy photos_block_delete on answer_photos for delete using (true);

/**
 * Records one uploaded photo. Idempotent, like submit_inspection: a retry
 * after a lost acknowledgement changes nothing.
 */
create function record_photo(
  p_id uuid,
  p_inspection_id uuid,
  p_item_id uuid,
  p_storage_path text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org();
begin
  if v_org is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- The photo must belong to an inspection of the caller's own organisation.
  -- Without this check any signed-in user could staple evidence onto another
  -- company's document.
  if not exists (
    select 1 from inspections i where i.id = p_inspection_id and i.org_id = v_org
  ) then
    raise exception 'inspection not found in your organisation' using errcode = 'P0002';
  end if;

  insert into answer_photos (id, inspection_id, item_id, storage_path)
  values (p_id, p_inspection_id, p_item_id, p_storage_path)
  on conflict (id) do nothing;
end $$;

grant execute on function record_photo(uuid, uuid, uuid, text) to authenticated;
