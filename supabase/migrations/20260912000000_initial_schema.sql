-- ============================================================================
-- Faena Inspector — initial schema
--
-- The device is the source of truth; this is the replica. Two rules shape
-- everything below:
--
--   1. A submitted inspection is a legal document and is NEVER edited. That is
--      enforced here, by Postgres, not by the client. There is deliberately no
--      UPDATE policy on `inspections`.
--   2. Uploads must be idempotent. The device generates the id (UUID v7) and
--      submits through a function that does nothing when the row already
--      exists, so retrying a hundred times still yields one inspection.
--
-- Depends on Supabase's `auth` schema (auth.users, auth.uid()).
-- ============================================================================

create type user_role as enum ('inspector', 'supervisor', 'admin');
create type answer_val as enum ('YES', 'NO', 'NA');
create type inspection_status as enum ('submitted', 'approved');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  org_id     uuid not null,
  full_name  text not null,
  job_title  text,
  role       user_role not null default 'inspector',
  created_at timestamptz not null default now()
);

create index profiles_org_idx on profiles (org_id);

-- Helpers. STABLE so the planner can cache them within a statement, and
-- SECURITY DEFINER so policies can read profiles without recursing into
-- the profiles policies themselves.
create function current_org() returns uuid
  language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

create function current_role_name() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Templates — pull-only towards the device
-- ---------------------------------------------------------------------------

create table templates (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  name           text not null,
  version        int  not null check (version > 0),
  effective_from date not null,
  published      boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (org_id, name, version)
);

create table template_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates on delete cascade,
  position    int  not null,
  code        text not null,
  title       text not null,
  unique (template_id, position)
);

create table template_items (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references template_sections on delete cascade,
  position   int  not null,
  code       text not null,
  label      text not null,
  unique (section_id, position)
);

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------

create table inspections (
  -- Generated on the DEVICE. Never by the server: that is what makes the
  -- upload idempotent.
  id               uuid primary key,
  org_id           uuid not null,
  template_id      uuid not null references templates,
  -- Frozen. A signed document must reprint identically in three years, even
  -- after the template has moved on five versions.
  template_version int  not null,

  vehicle_type text,
  plate        text not null,
  brand        text,
  model        text,
  year         int,
  driver_name  text,
  odometer_km  int,
  inspected_at timestamptz not null,

  general_observations text,

  declared_by_name       text not null,
  declared_by_role       text,
  declared_signature_path text,
  declared_at            timestamptz not null,

  -- Server-owned. Only approve_inspection() ever writes these.
  approved_by             uuid references profiles,
  approved_signature_path text,
  approved_at             timestamptz,

  status     inspection_status not null default 'submitted',
  created_by uuid not null references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inspections_org_idx    on inspections (org_id, inspected_at desc);
create index inspections_plate_idx  on inspections (org_id, plate);
create index inspections_status_idx on inspections (org_id, status);

create table answers (
  inspection_id uuid not null references inspections on delete cascade,
  item_id       uuid not null references template_items,
  value         answer_val not null,
  observation   text,
  -- The RESPONSABLE and FECHA columns of the source document: a NO is a task
  -- with an owner and a deadline, not a remark.
  responsible   text,
  due_date      date,
  updated_at    timestamptz not null default now(),
  primary key (inspection_id, item_id)
);

create index answers_finding_idx on answers (inspection_id) where value = 'NO';

create table answer_photos (
  id            uuid primary key,
  inspection_id uuid not null references inspections on delete cascade,
  item_id       uuid not null references template_items,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Findings
--
-- A view, not a table. A NO *is* a finding; duplicating it into its own table
-- means that the day the two drift apart, the supervisor's dashboard lies.
--
-- security_invoker makes the underlying RLS apply to the caller. Without it a
-- view runs as its owner and leaks across organisations.
-- ---------------------------------------------------------------------------

create view findings with (security_invoker = true) as
select
  a.inspection_id,
  a.item_id,
  ti.code  as item_code,
  ti.label as item_label,
  a.observation,
  a.responsible,
  a.due_date,
  (a.due_date is not null and a.due_date < current_date) as overdue,
  i.org_id,
  i.plate,
  i.inspected_at,
  i.status
from answers a
join inspections i    on i.id = a.inspection_id
join template_items ti on ti.id = a.item_id
where a.value = 'NO';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table profiles          enable row level security;
alter table templates         enable row level security;
alter table template_sections enable row level security;
alter table template_items    enable row level security;
alter table inspections       enable row level security;
alter table answers           enable row level security;
alter table answer_photos     enable row level security;

create policy profiles_read_org on profiles for select
  using (org_id = current_org());

create policy templates_read_org on templates for select
  using (org_id = current_org());

create policy sections_read_org on template_sections for select
  using (exists (select 1 from templates t where t.id = template_id and t.org_id = current_org()));

create policy items_read_org on template_items for select
  using (exists (
    select 1 from template_sections s
    join templates t on t.id = s.template_id
    where s.id = section_id and t.org_id = current_org()
  ));

-- Read everything in my organisation.
create policy inspections_read_org on inspections for select
  using (org_id = current_org());

create policy answers_read_org on answers for select
  using (exists (select 1 from inspections i where i.id = inspection_id and i.org_id = current_org()));

create policy photos_read_org on answer_photos for select
  using (exists (select 1 from inspections i where i.id = inspection_id and i.org_id = current_org()));

-- Writes happen only through the functions below. A signed inspection cannot be
-- altered by anyone, including its author.
--
-- These policies exist to make the refusal LOUD. Simply omitting an UPDATE
-- policy also protects the data, but RLS filters the rows away first: the
-- statement then reports success against zero rows and the caller never learns
-- it was rejected. For a document that will be signed, a silent no-op is the
-- wrong answer. `using (true)` lets the row reach the check, and
-- `with check (false)` — and the trigger, for DELETE — rejects it explicitly.
create policy inspections_block_update on inspections for update using (true) with check (false);
create policy inspections_block_delete on inspections for delete using (true);
create policy answers_block_update     on answers     for update using (true) with check (false);
create policy answers_block_delete     on answers     for delete using (true);

-- ---------------------------------------------------------------------------
-- Immutability, enforced by triggers
--
-- RLS alone is not enough here. With RLS on and no UPDATE policy, an UPDATE
-- does not fail — it silently matches zero rows. The data survives, but the
-- caller is told "success". For a signed legal document a silent no-op is the
-- wrong answer: it hides a bug, or an attack, instead of reporting it.
--
-- Triggers also close two holes policies cannot:
--   * someone later runs `grant update on inspections to authenticated`
--   * `service_role`, which bypasses RLS entirely, is used by mistake or leaks
--
-- A trigger fires for every writer, including the table owner and service_role.
-- ---------------------------------------------------------------------------

create function enforce_inspection_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'a submitted inspection cannot be deleted' using errcode = '42501';
  end if;

  -- Everything except the approval columns must stay byte-for-byte identical.
  if (to_jsonb(new)  - 'approved_by' - 'approved_signature_path' - 'approved_at' - 'status' - 'updated_at')
     is distinct from
     (to_jsonb(old)  - 'approved_by' - 'approved_signature_path' - 'approved_at' - 'status' - 'updated_at')
  then
    raise exception 'a submitted inspection is immutable' using errcode = '42501';
  end if;

  if old.status = 'approved' and new.status <> 'approved' then
    raise exception 'an approved inspection cannot be reopened' using errcode = '42501';
  end if;

  return new;
end $$;

create trigger inspections_immutable
  before update or delete on inspections
  for each row execute function enforce_inspection_immutable();

create function enforce_answer_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'answers of a submitted inspection are immutable' using errcode = '42501';
end $$;

create trigger answers_immutable
  before update or delete on answers
  for each row execute function enforce_answer_immutable();

-- ---------------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------------

-- Idempotent submission. The device may retry this forever; the second call
-- changes nothing and still succeeds.
create function submit_inspection(p_inspection jsonb, p_answers jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := current_org();
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
  on conflict (id) do nothing;   -- retry-safe: never overwrites a signed row

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

-- The only way those three approval columns are ever written.
create function approve_inspection(p_id uuid, p_signature_path text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := current_org();
  v_updated int;
begin
  if current_role_name() <> 'supervisor' then
    raise exception 'only a supervisor can approve an inspection' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select on profiles, templates, template_sections, template_items,
                inspections, answers, answer_photos, findings to authenticated;
grant execute on function submit_inspection(jsonb, jsonb) to authenticated;
grant execute on function approve_inspection(uuid, text) to authenticated;
grant execute on function current_org() to authenticated;
grant execute on function current_role_name() to authenticated;
