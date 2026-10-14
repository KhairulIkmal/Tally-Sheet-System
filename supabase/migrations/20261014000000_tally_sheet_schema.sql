-- Tally Sheet: digital Count Tally Sheet for goods leaving the warehouse.
--
-- Belongs in the shared "Lam Soon PSG Platform" project next to
-- room_booking / apex / a3. Like every other shared-schema migration it is
-- applied from the Portal repo (copy this file into
-- `Lam Soon PSG Portal/supabase/migrations/` before `db push`; check
-- `supabase migration list --linked` for a free version number first).
--
-- Model:
-- - System row `tally_sheet` is admin-managed (Portal → Admin → Systems),
--   launch_mode 'sso', and starts as 'coming-soon' with no address. An
--   admin sets the address and switches it online after the app deploys.
-- - Roles: `worker` (counts pallets, signs and submits sheets, sees their
--   own) and `office` (sees every sheet, prints, marks printed, manages
--   the product list). Both need an explicit grant; neither implies the
--   other.
-- - A sheet is written once, signed, by the worker who counted it. The
--   only later change is the office's printed flag. Drafts live on the
--   worker's device, never here.
-- - Pallet numbers are the sticker numbers: 1..n in item order, assigned
--   here from the submitted order so they are always contiguous.
-- - A mixed pallet is one pallet with several lines (batch / expired /
--   prod / qty); it prints as one row with stacked values.
--
-- Writes happen only through SECURITY DEFINER RPCs that derive the actor
-- from auth.uid() and check the role themselves. Clients get SELECT under
-- RLS for reads, nothing else.

create schema if not exists tally;

comment on schema tally is
  'Tally Sheet System. Identity and authorization come from public.profiles + user_system_access + user_system_roles for the tally_sheet system.';

-- =====================================================================
-- SYSTEM REGISTRATION
-- =====================================================================

insert into public.systems (
  slug, display_name, description, base_url, is_available, is_publicly_visible,
  is_admin_managed, abbr, full_name, category, card_status, launch_mode
)
values (
  'tally_sheet',
  'Tally Sheet',
  'Count pallets leaving the warehouse, sign on the phone, and let the office view and print the sheet.',
  null, false, true,
  true, 'TS', 'Count Tally Sheet', 'Logistics', 'coming-soon', 'sso'
)
on conflict (slug) do nothing;

insert into public.system_roles (system_id, key, display_name)
select id, 'worker', 'Worker' from public.systems where slug = 'tally_sheet'
on conflict (system_id, key) do nothing;

insert into public.system_roles (system_id, key, display_name)
select id, 'office', 'Office' from public.systems where slug = 'tally_sheet'
on conflict (system_id, key) do nothing;

-- =====================================================================
-- ACCESS HELPERS
-- =====================================================================

create or replace function tally.system_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.systems where slug = 'tally_sheet'; $$;

create or replace function tally.current_access_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_system_access usa on usa.user_id = p.id
    where p.id = auth.uid()
      and p.account_status = 'active'
      and usa.system_id = tally.system_id()
      and usa.status = 'active'
  );
$$;

create or replace function tally.has_role(p_role text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    tally.current_access_active()
    and exists (
      select 1 from public.user_system_roles usr
      join public.system_roles sr on sr.id = usr.system_role_id
      where usr.user_id = auth.uid() and sr.system_id = tally.system_id() and sr.key = p_role
    ),
    false
  );
$$;

create or replace function tally.is_worker()
returns boolean language sql stable security definer set search_path = ''
as $$ select tally.has_role('worker'); $$;

create or replace function tally.is_office()
returns boolean language sql stable security definer set search_path = ''
as $$ select tally.has_role('office'); $$;

-- The caller's Tally Sheet roles (empty when access is not active).
create or replace function tally.current_roles()
returns text[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(sr.key order by sr.key), '{}')
  from public.user_system_roles usr
  join public.system_roles sr on sr.id = usr.system_role_id
  where tally.current_access_active()
    and usr.user_id = auth.uid()
    and sr.system_id = tally.system_id()
    and sr.key in ('worker', 'office');
$$;

-- =====================================================================
-- TYPES AND TABLES
-- =====================================================================

create type tally.sheet_form as enum ('container', 'lorry');
create type tally.sheet_status as enum ('submitted', 'printed');

create table tally.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 80),
  sku             text check (sku is null or length(btrim(sku)) between 1 and 30),
  ctn_per_pallet  int check (ctn_per_pallet is null or ctn_per_pallet between 1 and 999),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

create unique index products_name_key on tally.products (upper(btrim(name)));

comment on table tally.products is
  'Product master for the worker''s item picker. Workers may still type a name that is not listed.';

create table tally.reference_counter (
  period       text primary key check (period ~ '^\d{4}$'),
  last_number  int not null default 0 check (last_number >= 0)
);

create table tally.sheets (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null unique,
  ref               text not null unique check (ref ~ '^TS-\d{4}-\d{4,}$'),
  form              tally.sheet_form not null,
  sheet_date        date not null,
  contract_no       text check (contract_no is null or length(contract_no) <= 60),
  container_no      text check (container_no is null or length(container_no) <= 60),
  seal_no           text check (seal_no is null or length(seal_no) <= 60),
  si_no             text check (si_no is null or length(si_no) <= 60),
  disport           text check (disport is null or length(disport) <= 60),
  transfer_to       text check (transfer_to is null or length(transfer_to) <= 80),
  do_no             text check (do_no is null or length(do_no) <= 60),
  lorry_no          text check (lorry_no is null or length(lorry_no) <= 30),
  remark            text check (remark is null or length(remark) <= 300),
  materials         jsonb not null default '{}'::jsonb,
  checks            jsonb not null default '{}'::jsonb,
  plt_counts        jsonb not null default '{}'::jsonb,
  total_pallets     int not null check (total_pallets between 1 and 200),
  total_ctn         int not null check (total_ctn >= 0),
  signature         text not null check (signature like 'data:image/png;base64,%' and length(signature) <= 300000),
  prepared_by       uuid not null references public.profiles (id),
  prepared_by_name  text not null,
  signed_at         timestamptz not null,
  submitted_at      timestamptz not null default now(),
  device            text check (device is null or length(device) <= 160),
  status            tally.sheet_status not null default 'submitted',
  printed_at        timestamptz,
  printed_by        uuid references public.profiles (id),
  printed_by_name   text,
  constraint sheets_container_header check (
    form <> 'container' or (
      nullif(btrim(contract_no), '') is not null and nullif(btrim(container_no), '') is not null
      and nullif(btrim(seal_no), '') is not null and nullif(btrim(si_no), '') is not null
      and nullif(btrim(disport), '') is not null
    )
  ),
  constraint sheets_lorry_header check (
    form <> 'lorry' or (
      nullif(btrim(transfer_to), '') is not null and nullif(btrim(do_no), '') is not null
      and nullif(btrim(lorry_no), '') is not null
    )
  ),
  constraint sheets_printed_shape check ((status = 'printed') = (printed_at is not null))
);

create index sheets_submitted_at_idx on tally.sheets (submitted_at desc);
create index sheets_prepared_by_idx on tally.sheets (prepared_by, submitted_at desc);

create table tally.sheet_items (
  sheet_id    uuid not null references tally.sheets (id) on delete cascade,
  item_no     int not null check (item_no between 1 and 50),
  name        text not null check (length(btrim(name)) between 1 and 80),
  product_id  uuid references tally.products (id) on delete set null,
  target_ctn  int check (target_ctn is null or target_ctn between 1 and 99999),
  primary key (sheet_id, item_no)
);

create table tally.sheet_pallets (
  sheet_id     uuid not null,
  pallet_no    int not null check (pallet_no between 1 and 200),
  item_no      int not null,
  plt_type     text check (plt_type is null or plt_type in ('L', 'E', 'C', 'O')),
  contract_no  text check (contract_no is null or length(contract_no) <= 60),
  remark       text check (remark is null or length(remark) <= 60),
  primary key (sheet_id, pallet_no),
  foreign key (sheet_id, item_no) references tally.sheet_items (sheet_id, item_no) on delete cascade
);

create table tally.pallet_lines (
  sheet_id   uuid not null,
  pallet_no  int not null,
  line_no    int not null check (line_no between 1 and 6),
  qty        int check (qty is null or qty between 0 and 99999),
  batch      text check (batch is null or length(batch) <= 40),
  expired    date,
  prod       date,
  primary key (sheet_id, pallet_no, line_no),
  foreign key (sheet_id, pallet_no) references tally.sheet_pallets (sheet_id, pallet_no) on delete cascade
);

create table tally.sheet_events (
  id        bigint generated always as identity primary key,
  sheet_id  uuid not null references tally.sheets (id) on delete cascade,
  event     text not null check (event in ('submitted', 'printed', 'unprinted')),
  actor_id    uuid references public.profiles (id),
  actor_name  text,
  at          timestamptz not null default now()
);

create index sheet_events_sheet_idx on tally.sheet_events (sheet_id, at);

-- =====================================================================
-- READ HELPERS
-- =====================================================================

create or replace function tally.can_read_sheet(p_sheet_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select tally.is_office()
    or (tally.is_worker() and exists (
      select 1 from tally.sheets s where s.id = p_sheet_id and s.prepared_by = auth.uid()
    ));
$$;

-- The caller's identity for the app shell (null when not authorized).
create or replace function tally.me()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when cardinality(tally.current_roles()) > 0 then
    jsonb_build_object(
      'userId', p.id,
      'name', p.full_name,
      'email', p.company_email,
      'department', (select d.name from public.departments d where d.id = p.department_id),
      'roles', to_jsonb(tally.current_roles())
    )
  end
  from public.profiles p where p.id = auth.uid();
$$;

-- =====================================================================
-- WRITE RPCs
-- =====================================================================

-- Small parsing helpers used by submit_sheet only.
create or replace function tally.clean_text(p text, p_max int)
returns text language sql immutable set search_path = ''
as $$ select nullif(left(upper(btrim(coalesce(p, ''))), p_max), ''); $$;

create or replace function tally.json_int(p jsonb)
returns int language plpgsql immutable set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) = 'number' then return (p #>> '{}')::numeric::int; end if;
  if jsonb_typeof(p) = 'string' and btrim(p #>> '{}') ~ '^\d{1,6}$' then return btrim(p #>> '{}')::int; end if;
  if jsonb_typeof(p) = 'string' and btrim(p #>> '{}') = '' then return null; end if;
  raise exception 'Expected a whole number, got %', p using errcode = 'invalid_parameter_value';
end;
$$;

create or replace function tally.json_date(p jsonb)
returns date language plpgsql immutable set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) = 'null' or btrim(p #>> '{}') = '' then return null; end if;
  if (p #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Expected a date as YYYY-MM-DD, got %', p using errcode = 'invalid_parameter_value';
  end if;
  return (p #>> '{}')::date;
end;
$$;

-- Submits one signed sheet. Idempotent on clientId: a phone that lost its
-- connection after the insert can retry and gets the same reference back.
create or replace function tally.submit_sheet(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_client_id  uuid;
  v_existing   tally.sheets;
  v_form       tally.sheet_form;
  v_name       text;
  v_period     text;
  v_number     int;
  v_ref        text;
  v_sheet_id   uuid;
  v_item       record;
  v_pallet     record;
  v_line       record;
  v_pallet_no  int := 0;
  v_total_ctn  int := 0;
  v_qty        int;
  v_lines      int;
  v_header     jsonb := coalesce(p -> 'header', '{}'::jsonb);
  v_materials  jsonb := '{}'::jsonb;
  v_checks     jsonb := '{}'::jsonb;
  v_plt        jsonb := '{}'::jsonb;
  v_key        text;
  v_product    uuid;
begin
  if not tally.is_worker() then
    raise exception 'Only a Tally Sheet worker can submit a sheet.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p) is distinct from 'object' then
    raise exception 'Sheet payload must be an object.' using errcode = 'invalid_parameter_value';
  end if;

  begin
    v_client_id := (p ->> 'clientId')::uuid;
  exception when others then
    raise exception 'clientId must be a UUID.' using errcode = 'invalid_parameter_value';
  end;
  if v_client_id is null then
    raise exception 'clientId is required.' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_existing from tally.sheets where client_id = v_client_id;
  if found then
    if v_existing.prepared_by <> v_uid then
      raise exception 'This sheet was already submitted by someone else.' using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('id', v_existing.id, 'ref', v_existing.ref, 'duplicate', true);
  end if;

  if (p ->> 'form') not in ('container', 'lorry') then
    raise exception 'form must be container or lorry.' using errcode = 'invalid_parameter_value';
  end if;
  v_form := (p ->> 'form')::tally.sheet_form;

  if jsonb_typeof(p -> 'items') is distinct from 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'A sheet needs at least one item.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(p -> 'items') > 50 then
    raise exception 'A sheet can hold at most 50 items.' using errcode = 'invalid_parameter_value';
  end if;

  select full_name into v_name from public.profiles where id = v_uid;

  -- Packing materials / checks / pallet-type counts: fixed keys only.
  if v_form = 'container' then
    foreach v_key in array array['SAMPLE', 'EMPTY CTN', 'PE BAG', 'WOODEN FRAME', 'PLYWOOD', 'LINER', 'LAYER PAD', 'AIR BAG', 'POLYFOAM'] loop
      v_qty := coalesce(tally.json_int(p -> 'materials' -> v_key), 0);
      if v_qty < 0 or v_qty > 9999 then
        raise exception 'Material % is out of range.', v_key using errcode = 'invalid_parameter_value';
      end if;
      v_materials := v_materials || jsonb_build_object(v_key, v_qty);
    end loop;
  else
    foreach v_key in array array['SAMPLE', 'EMPTY CTN', 'OTHERS'] loop
      v_checks := v_checks || jsonb_build_object(v_key, jsonb_build_object(
        'on', coalesce((p -> 'checks' -> v_key ->> 'on')::boolean, false),
        'note', coalesce(tally.clean_text(p -> 'checks' -> v_key ->> 'note', 60), '')
      ));
    end loop;
    foreach v_key in array array['L', 'E', 'C', 'O'] loop
      v_qty := coalesce(tally.json_int(p -> 'pltCounts' -> v_key), 0);
      if v_qty < 0 or v_qty > 200 then
        raise exception 'Pallet count % is out of range.', v_key using errcode = 'invalid_parameter_value';
      end if;
      v_plt := v_plt || jsonb_build_object(v_key, v_qty);
    end loop;
  end if;

  v_period := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM');
  insert into tally.reference_counter (period, last_number) values (v_period, 1)
  on conflict (period) do update set last_number = tally.reference_counter.last_number + 1
  returning last_number into v_number;
  v_ref := 'TS-' || v_period || '-' || lpad(v_number::text, 4, '0');

  -- Totals are filled in after the pallets; insert with placeholders that
  -- satisfy the checks, then update once inside this same transaction.
  insert into tally.sheets (
    client_id, ref, form, sheet_date,
    contract_no, container_no, seal_no, si_no, disport,
    transfer_to, do_no, lorry_no, remark,
    materials, checks, plt_counts, total_pallets, total_ctn,
    signature, prepared_by, prepared_by_name, signed_at, device
  )
  values (
    v_client_id, v_ref, v_form, coalesce(tally.json_date(p -> 'date'), (now() at time zone 'Asia/Kuala_Lumpur')::date),
    case when v_form = 'container' then tally.clean_text(v_header ->> 'contractNo', 60) end,
    case when v_form = 'container' then tally.clean_text(v_header ->> 'containerNo', 60) end,
    case when v_form = 'container' then tally.clean_text(v_header ->> 'sealNo', 60) end,
    case when v_form = 'container' then tally.clean_text(v_header ->> 'siNo', 60) end,
    case when v_form = 'container' then tally.clean_text(v_header ->> 'disport', 60) end,
    case when v_form = 'lorry' then tally.clean_text(v_header ->> 'transferTo', 80) end,
    case when v_form = 'lorry' then tally.clean_text(v_header ->> 'doNo', 60) end,
    case when v_form = 'lorry' then tally.clean_text(v_header ->> 'lorryNo', 30) end,
    tally.clean_text(p ->> 'remark', 300),
    v_materials, v_checks, v_plt, 1, 0,
    p ->> 'signature', v_uid, coalesce(v_name, ''),
    coalesce((p ->> 'signedAt')::timestamptz, now()),
    nullif(left(btrim(coalesce(p ->> 'device', '')), 160), '')
  )
  returning id into v_sheet_id;

  for v_item in
    select value as it, ordinality::int as item_no
    from jsonb_array_elements(p -> 'items') with ordinality
  loop
    v_product := null;
    if nullif(v_item.it ->> 'productId', '') is not null then
      begin
        v_product := (v_item.it ->> 'productId')::uuid;
      exception when others then
        v_product := null;
      end;
      if v_product is not null and not exists (select 1 from tally.products where id = v_product) then
        v_product := null;
      end if;
    end if;

    if tally.clean_text(v_item.it ->> 'name', 80) is null then
      raise exception 'Item % has no name.', v_item.item_no using errcode = 'invalid_parameter_value';
    end if;

    insert into tally.sheet_items (sheet_id, item_no, name, product_id, target_ctn)
    values (v_sheet_id, v_item.item_no, tally.clean_text(v_item.it ->> 'name', 80), v_product,
            nullif(tally.json_int(v_item.it -> 'targetCtn'), 0));

    if jsonb_typeof(v_item.it -> 'pallets') is distinct from 'array' or jsonb_array_length(v_item.it -> 'pallets') = 0 then
      raise exception 'Item % has no pallets.', v_item.item_no using errcode = 'invalid_parameter_value';
    end if;

    for v_pallet in
      select value as pl from jsonb_array_elements(v_item.it -> 'pallets') with ordinality order by ordinality
    loop
      v_pallet_no := v_pallet_no + 1;
      if v_pallet_no > 200 then
        raise exception 'A sheet can hold at most 200 pallets.' using errcode = 'invalid_parameter_value';
      end if;

      if v_form = 'lorry' and coalesce(v_pallet.pl ->> 'pltType', '') not in ('L', 'E', 'C', 'O') then
        raise exception 'Pallet % needs a PLT type (L, E, C or O).', v_pallet_no using errcode = 'invalid_parameter_value';
      end if;

      insert into tally.sheet_pallets (sheet_id, pallet_no, item_no, plt_type, contract_no, remark)
      values (
        v_sheet_id, v_pallet_no, v_item.item_no,
        case when v_form = 'lorry' then v_pallet.pl ->> 'pltType' end,
        case when v_form = 'lorry' then tally.clean_text(v_pallet.pl ->> 'contractNo', 60) end,
        tally.clean_text(v_pallet.pl ->> 'remark', 60)
      );

      v_lines := coalesce(jsonb_array_length(case when jsonb_typeof(v_pallet.pl -> 'lines') = 'array' then v_pallet.pl -> 'lines' end), 0);
      if v_lines = 0 or v_lines > 6 then
        raise exception 'Pallet % must have 1 to 6 lines.', v_pallet_no using errcode = 'invalid_parameter_value';
      end if;

      for v_line in
        select value as ln, ordinality::int as line_no
        from jsonb_array_elements(v_pallet.pl -> 'lines') with ordinality
      loop
        v_qty := tally.json_int(v_line.ln -> 'qty');
        insert into tally.pallet_lines (sheet_id, pallet_no, line_no, qty, batch, expired, prod)
        values (
          v_sheet_id, v_pallet_no, v_line.line_no, v_qty,
          tally.clean_text(v_line.ln ->> 'batch', 40),
          tally.json_date(v_line.ln -> 'expired'),
          tally.json_date(v_line.ln -> 'prod')
        );
        v_total_ctn := v_total_ctn + coalesce(v_qty, 0);
      end loop;
    end loop;
  end loop;

  update tally.sheets set total_pallets = v_pallet_no, total_ctn = v_total_ctn where id = v_sheet_id;

  insert into tally.sheet_events (sheet_id, event, actor_id, actor_name) values (v_sheet_id, 'submitted', v_uid, v_name);

  return jsonb_build_object('id', v_sheet_id, 'ref', v_ref, 'duplicate', false);
end;
$$;

-- Office marks a sheet printed (or undoes it).
create or replace function tally.set_sheet_printed(p_sheet_id uuid, p_printed boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status tally.sheet_status;
  v_name   text;
begin
  if not tally.is_office() then
    raise exception 'Only the office can change a sheet''s printed status.' using errcode = 'insufficient_privilege';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  select status into v_status from tally.sheets where id = p_sheet_id for update;
  if not found then
    raise exception 'Sheet not found.' using errcode = 'no_data_found';
  end if;

  if p_printed and v_status = 'submitted' then
    update tally.sheets
    set status = 'printed', printed_at = now(), printed_by = auth.uid(), printed_by_name = v_name
    where id = p_sheet_id;
    insert into tally.sheet_events (sheet_id, event, actor_id, actor_name) values (p_sheet_id, 'printed', auth.uid(), v_name);
  elsif not p_printed and v_status = 'printed' then
    update tally.sheets
    set status = 'submitted', printed_at = null, printed_by = null, printed_by_name = null
    where id = p_sheet_id;
    insert into tally.sheet_events (sheet_id, event, actor_id, actor_name) values (p_sheet_id, 'unprinted', auth.uid(), v_name);
  end if;
end;
$$;

-- Office adds or edits a product (p_id null = add).
create or replace function tally.save_product(
  p_id uuid,
  p_name text,
  p_sku text,
  p_ctn_per_pallet int,
  p_is_active boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not tally.is_office() then
    raise exception 'Only the office can manage products.' using errcode = 'insufficient_privilege';
  end if;

  if tally.clean_text(p_name, 80) is null then
    raise exception 'Product name is required.' using errcode = 'invalid_parameter_value';
  end if;

  if p_id is null then
    insert into tally.products (name, sku, ctn_per_pallet, is_active, updated_by)
    values (tally.clean_text(p_name, 80), tally.clean_text(p_sku, 30), p_ctn_per_pallet, coalesce(p_is_active, true), auth.uid())
    returning id into v_id;
  else
    update tally.products
    set name = tally.clean_text(p_name, 80),
        sku = tally.clean_text(p_sku, 30),
        ctn_per_pallet = p_ctn_per_pallet,
        is_active = coalesce(p_is_active, is_active),
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Product not found.' using errcode = 'no_data_found';
    end if;
  end if;

  return v_id;
end;
$$;

-- =====================================================================
-- RLS (reads only; every write goes through the RPCs above)
-- =====================================================================

alter table tally.products enable row level security;
alter table tally.reference_counter enable row level security;
alter table tally.sheets enable row level security;
alter table tally.sheet_items enable row level security;
alter table tally.sheet_pallets enable row level security;
alter table tally.pallet_lines enable row level security;
alter table tally.sheet_events enable row level security;

create policy products_select on tally.products for select using (tally.is_worker() or tally.is_office());
create policy sheets_select on tally.sheets for select using (
  tally.is_office() or (tally.is_worker() and prepared_by = auth.uid())
);
create policy sheet_items_select on tally.sheet_items for select using (tally.can_read_sheet(sheet_id));
create policy sheet_pallets_select on tally.sheet_pallets for select using (tally.can_read_sheet(sheet_id));
create policy pallet_lines_select on tally.pallet_lines for select using (tally.can_read_sheet(sheet_id));
create policy sheet_events_select on tally.sheet_events for select using (tally.is_office());
-- reference_counter: no policy (no client access at all).

-- =====================================================================
-- GRANTS
-- =====================================================================

revoke all on schema tally from public;
grant usage on schema tally to authenticated;

revoke all on all tables in schema tally from public, anon, authenticated;
grant select on tally.products, tally.sheets, tally.sheet_items, tally.sheet_pallets,
  tally.pallet_lines, tally.sheet_events to authenticated;

revoke all on all functions in schema tally from public, anon, authenticated;

grant execute on function
  tally.current_access_active(), tally.has_role(text), tally.is_worker(), tally.is_office(),
  tally.current_roles(), tally.can_read_sheet(uuid), tally.me(),
  tally.submit_sheet(jsonb), tally.set_sheet_printed(uuid, boolean),
  tally.save_product(uuid, text, text, int, boolean)
to authenticated;

alter default privileges in schema tally revoke execute on functions from public;
