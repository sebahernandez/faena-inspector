-- ============================================================================
-- Closing a finding
--
-- A finding is a NO inside a signed inspection, and that inspection is
-- immutable — so closing one CANNOT write to it. A closure is a separate fact
-- that points at the finding: who verified the correction, when, and with what
-- evidence. The original document stays exactly as it was signed.
--
-- Closures are immutable too. A compliance record is append-only: if a closure
-- turns out to be wrong, the next inspection of that truck will raise the item
-- again, which is the honest trail. Editing history to look clean is the one
-- thing a record like this must never allow.
-- ============================================================================

create table finding_closures (
  inspection_id uuid not null,
  item_id       uuid not null,
  org_id        uuid not null,
  note          text not null check (length(trim(note)) >= 3),
  evidence_path text,
  closed_by     uuid not null references profiles,
  closed_at     timestamptz not null default now(),
  primary key (inspection_id, item_id),
  foreign key (inspection_id, item_id) references answers (inspection_id, item_id) on delete cascade
);

create index finding_closures_org_idx on finding_closures (org_id, closed_at desc);

alter table finding_closures enable row level security;

create policy closures_read_org on finding_closures for select
  using (org_id = private.current_org());

-- Writes go through close_finding() only, and refuse loudly.
create policy closures_block_update on finding_closures for update using (true) with check (false);
create policy closures_block_delete on finding_closures for delete using (true);

create function enforce_closure_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'a closed finding cannot be edited or reopened' using errcode = '42501';
end $$;

create trigger finding_closures_immutable
  before update or delete on finding_closures
  for each row execute function enforce_closure_immutable();

/**
 * Fleet-wide findings: every NO of every inspection, with its closure if any.
 *
 * `overdue` only means something for an OPEN finding — a corrected item is not
 * late, it is done.
 */
create view fleet_findings with (security_invoker = true) as
select
  a.inspection_id,
  a.item_id,
  i.org_id,
  i.plate,
  i.inspected_at,
  i.status as inspection_status,
  i.declared_by_name,
  ti.code  as item_code,
  ti.label as item_label,
  ts.code  as section_code,
  ts.title as section_title,
  a.observation,
  a.responsible,
  a.due_date,
  (c.inspection_id is not null) as closed,
  c.closed_at,
  c.note as closure_note,
  c.evidence_path as closure_evidence_path,
  p.full_name as closed_by_name,
  (c.inspection_id is null
     and a.due_date is not null
     and a.due_date < current_date) as overdue
from answers a
join inspections i        on i.id = a.inspection_id
join template_items ti    on ti.id = a.item_id
join template_sections ts on ts.id = ti.section_id
left join finding_closures c on c.inspection_id = a.inspection_id and c.item_id = a.item_id
left join profiles p         on p.id = c.closed_by
where a.value = 'NO';

grant select on fleet_findings to authenticated;
grant select on finding_closures to authenticated;

/**
 * Records a correction. Idempotent: a retry after a lost acknowledgement
 * changes nothing rather than failing.
 */
create function close_finding(
  p_inspection_id uuid,
  p_item_id uuid,
  p_note text,
  p_evidence_path text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := private.current_org();
begin
  if private.current_role_name() not in ('supervisor', 'admin') then
    raise exception 'only a supervisor can close a finding' using errcode = '42501';
  end if;

  if not exists (
    select 1 from answers a
    join inspections i on i.id = a.inspection_id
    where a.inspection_id = p_inspection_id
      and a.item_id = p_item_id
      and a.value = 'NO'
      and i.org_id = v_org
  ) then
    raise exception 'finding not found in your organisation' using errcode = 'P0002';
  end if;

  insert into finding_closures (inspection_id, item_id, org_id, note, evidence_path, closed_by)
  values (p_inspection_id, p_item_id, v_org, p_note, p_evidence_path, v_uid)
  on conflict (inspection_id, item_id) do nothing;
end $$;

revoke execute on function close_finding(uuid, uuid, text, text) from public, anon;
grant execute on function close_finding(uuid, uuid, text, text) to authenticated;
