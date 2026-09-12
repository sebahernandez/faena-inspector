-- ============================================================================
-- Views for the supervisor panel
--
-- The panel reads; it never assembles the document from loose pieces on the
-- client. Everything here is security_invoker, so the caller's own RLS applies
-- and a supervisor sees exactly their organisation and nothing else.
-- ============================================================================

/**
 * Every answered item of an inspection, already joined to its label and in
 * printing order. Without this the panel would have to fetch three tables and
 * sort them itself, and a sorting bug would silently reorder a legal document.
 */
create view inspection_answers with (security_invoker = true) as
select
  a.inspection_id,
  i.org_id,
  ts.position as section_position,
  ts.code     as section_code,
  ts.title    as section_title,
  ti.position as item_position,
  ti.code     as item_code,
  ti.label    as item_label,
  a.item_id,
  a.value,
  a.observation,
  a.responsible,
  a.due_date
from answers a
join inspections i       on i.id = a.inspection_id
join template_items ti   on ti.id = a.item_id
join template_sections ts on ts.id = ti.section_id;

/**
 * One row per inspection with its tallies, so the list does not have to pull
 * every answer of every inspection just to show "3 hallazgos".
 */
create view inspection_summaries with (security_invoker = true) as
select
  i.id,
  i.org_id,
  i.plate,
  i.vehicle_type,
  i.driver_name,
  i.odometer_km,
  i.inspected_at,
  i.declared_by_name,
  i.declared_by_role,
  i.declared_at,
  i.approved_at,
  i.status,
  p.full_name as approved_by_name,
  count(a.*) filter (where a.value = 'YES') as yes_count,
  count(a.*) filter (where a.value = 'NO')  as no_count,
  count(a.*) filter (where a.value = 'NA')  as na_count,
  count(a.*)                                 as answered_count,
  count(ph.*)                                as photo_count
from inspections i
left join answers a       on a.inspection_id = i.id
left join answer_photos ph on ph.inspection_id = i.id
left join profiles p       on p.id = i.approved_by
group by i.id, p.full_name;

grant select on inspection_answers, inspection_summaries to authenticated;
