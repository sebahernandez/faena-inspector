-- ============================================================================
-- Separation of duties on approval
--
-- The source form has two signature blocks — DECLARADO POR and APROBADO POR —
-- because somebody other than the author checks the work. An inspector who is
-- later promoted to supervisor could, until now, sign off their own inspection:
-- a rubber stamp wearing the costume of a review.
--
-- The UI already refuses it. This makes it true.
-- ============================================================================

create or replace function approve_inspection(p_id uuid, p_signature_path text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := current_org();
  v_author uuid;
  v_updated int;
begin
  if current_role_name() <> 'supervisor' then
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
