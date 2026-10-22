-- pgTAP: Tally Sheet schema (20261015000000_tally_sheet_schema).
-- Roles, submit_sheet (numbering, idempotency, validation), RLS reads,
-- printed flag and item history. Runs inside a transaction and rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

create temp table r (k text primary key, v jsonb);
grant all on r to public;

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;
create function pg_temp.try(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;
-- Runs p_sql and rolls it back: 'ok' when it succeeded, else the error code. For a check that must
-- succeed without leaving a row behind for the later tests.
create function pg_temp.try_rolled_back(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'rolled back' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    return 'ok';
  end;
exception when others then
  return sqlstate;
end;
$$;
create function pg_temp.keep(p_key text, p_value jsonb) returns void language sql as $$
  insert into r (k, v) values (p_key, p_value) on conflict (k) do update set v = excluded.v;
$$;
create function pg_temp.got(p_key text) returns jsonb language sql as $$ select v from r where k = p_key $$;

-- t1 worker · t2 office · t3 second worker · t4 active access, no role · t5 no access
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-0000-0000-0000000007a' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'tally.t' || n || '@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', 'Tally Tester ' || n), now(), now()
from generate_series(1, 5) as n;

insert into public.user_system_access (user_id, system_id, status)
select ('00000000-0000-0000-0000-0000000007a' || n)::uuid, (select id from public.systems where slug = 'tally_sheet'), 'active'
from generate_series(1, 4) as n;

insert into public.user_system_roles (user_id, system_role_id)
select u, (select sr.id from public.system_roles sr join public.systems s on s.id = sr.system_id where s.slug = 'tally_sheet' and sr.key = k)
from (values
  ('00000000-0000-0000-0000-0000000007a1'::uuid, 'worker'),
  ('00000000-0000-0000-0000-0000000007a2'::uuid, 'office'),
  ('00000000-0000-0000-0000-0000000007a3'::uuid, 'worker')
) as v(u, k);

-- A lorry sheet: item 1 has 2 pallets (the second mixed), item 2 has 1.
create function pg_temp.sheet(p_client uuid) returns jsonb language sql as $$
  select jsonb_build_object(
    'clientId', p_client, 'form', 'lorry', 'date', '2026-10-14',
    'header', jsonb_build_object('transferTo', 'shah alam dc', 'doNo', 'do-1', 'lorryNo', 'wxy 1'),
    'items', jsonb_build_array(
      jsonb_build_object('name', 'margarine 5kg', 'unit', 'ctn', 'targetQty', 52, 'qtyPerPallet', 32, 'pallets', jsonb_build_array(
        jsonb_build_object('pltType', 'L', 'contractNo', 'ls-1', 'remark', '', 'lines', jsonb_build_array(
          jsonb_build_object('qty', 32, 'batch', 'b1', 'expired', '2027-04-16', 'prod', '2025-04-16'))),
        jsonb_build_object('pltType', 'C', 'contractNo', 'ls-1', 'remark', 'mixed', 'lines', jsonb_build_array(
          jsonb_build_object('qty', 12, 'batch', 'b1', 'expired', '2027-04-16', 'prod', null),
          jsonb_build_object('qty', 8, 'batch', 'b2', 'expired', null, 'prod', null))))),
      jsonb_build_object('name', 'ghee 2kg', 'unit', 'tin', 'targetQty', null, 'qtyPerPallet', null, 'pallets', jsonb_build_array(
        jsonb_build_object('pltType', 'L', 'contractNo', '', 'remark', '', 'lines', jsonb_build_array(
          jsonb_build_object('qty', 72, 'batch', '', 'expired', null, 'prod', null)))))),
    'checks', jsonb_build_object('SAMPLE', jsonb_build_object('qty', 2, 'note', 'for qc'), 'OTHERS', jsonb_build_object('qty', '3', 'note', '')),
    'pltCounts', jsonb_build_object('L', 2, 'C', 1, 'X', 99),
    'remark', 'ok', 'signature', 'data:image/png;base64,AAAA', 'signedAt', '2026-10-14T07:00:00Z', 'device', 'pgtap'
  );
$$;

set local role authenticated;

-- ═══ Worker t1 ═══
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select pg_temp.keep('me_roles', tally.me() -> 'roles');
select pg_temp.keep('s1', tally.submit_sheet(pg_temp.sheet('11111111-1111-4111-8111-111111111111')));
select pg_temp.keep('s1_again', tally.submit_sheet(pg_temp.sheet('11111111-1111-4111-8111-111111111111')));
select pg_temp.keep('s2', tally.submit_sheet(pg_temp.sheet('22222222-2222-4222-8222-222222222222')));
select pg_temp.keep('bad_form', to_jsonb(pg_temp.try($$ select tally.submit_sheet(pg_temp.sheet('33333333-3333-4333-8333-333333333333') || '{"form":"ship"}') $$)));
select pg_temp.keep('no_header', to_jsonb(pg_temp.try_rolled_back($$
  select tally.submit_sheet(jsonb_set(pg_temp.sheet('33333333-3333-4333-8333-333333333333'), '{header,lorryNo}', '""')) $$)));
select pg_temp.keep('no_plt_type', to_jsonb(pg_temp.try($$
  select tally.submit_sheet(jsonb_set(pg_temp.sheet('33333333-3333-4333-8333-333333333333'), '{items,0,pallets,0,pltType}', 'null')) $$)));
select pg_temp.keep('bad_date', to_jsonb(pg_temp.try($$
  select tally.submit_sheet(jsonb_set(pg_temp.sheet('33333333-3333-4333-8333-333333333333'), '{items,0,pallets,0,lines,0,expired}', '"16/04/27"')) $$)));
select pg_temp.keep('bad_sig', to_jsonb(pg_temp.try($$
  select tally.submit_sheet(jsonb_set(pg_temp.sheet('33333333-3333-4333-8333-333333333333'), '{signature}', '"javascript:alert(1)"')) $$)));
select pg_temp.keep('no_items', to_jsonb(pg_temp.try($$
  select tally.submit_sheet(jsonb_set(pg_temp.sheet('33333333-3333-4333-8333-333333333333'), '{items}', '[]')) $$)));
select pg_temp.keep('w_sees', to_jsonb((select count(*) from tally.sheets)));
select pg_temp.keep('w_lines', to_jsonb((select count(*) from tally.pallet_lines)));
select pg_temp.keep('w_events', to_jsonb((select count(*) from tally.sheet_events)));
select pg_temp.keep('w_print', to_jsonb(pg_temp.try(format('select tally.set_sheet_printed(%L, true)', pg_temp.got('s1') ->> 'id'))));
select pg_temp.keep('w_history', (select jsonb_agg(jsonb_build_array(name, unit, qty_per_pallet, use_count) order by name) from tally.item_history));
select pg_temp.keep('w_product', to_jsonb(pg_temp.try($$
  select tally.save_history_item((select id from tally.item_history where name = 'GHEE 2KG'), 'x', 'CTN', 10, true) $$)));
select pg_temp.keep('w_insert', to_jsonb(pg_temp.try($$ insert into tally.item_history (name) values ('DIRECT') $$)));
select pg_temp.keep('w_update', to_jsonb(pg_temp.try($$ update tally.sheets set total_pallets = 1 $$)));
select pg_temp.keep('bad_unit', to_jsonb(pg_temp.try($$
  select tally.submit_sheet(jsonb_set(pg_temp.sheet('33333333-3333-4333-8333-333333333333'), '{items,0,unit}', '"<script>"')) $$)));

-- ═══ Worker t3 cannot see t1's sheets ═══
select pg_temp.login('00000000-0000-0000-0000-0000000007a3');
select pg_temp.keep('w3_sees', to_jsonb((select count(*) from tally.sheets)));
select pg_temp.keep('w3_lines', to_jsonb((select count(*) from tally.pallet_lines)));
select pg_temp.keep('w3_dup_client', to_jsonb(pg_temp.try($$ select tally.submit_sheet(pg_temp.sheet('11111111-1111-4111-8111-111111111111')) $$)));

-- ═══ No role / no access ═══
select pg_temp.login('00000000-0000-0000-0000-0000000007a4');
select pg_temp.keep('norole_me', coalesce(tally.me(), 'null'::jsonb));
select pg_temp.keep('norole_submit', to_jsonb(pg_temp.try($$ select tally.submit_sheet(pg_temp.sheet('44444444-4444-4444-8444-444444444444')) $$)));
select pg_temp.login('00000000-0000-0000-0000-0000000007a5');
select pg_temp.keep('noaccess_sees', to_jsonb((select count(*) from tally.sheets)));

-- ═══ Office t2 ═══
select pg_temp.login('00000000-0000-0000-0000-0000000007a2');
select pg_temp.keep('o_sees', to_jsonb((select count(*) from tally.sheets)));
select pg_temp.keep('o_submit', to_jsonb(pg_temp.try($$ select tally.submit_sheet(pg_temp.sheet('55555555-5555-4555-8555-555555555555')) $$)));
select tally.set_sheet_printed((pg_temp.got('s1') ->> 'id')::uuid, true);
select tally.set_sheet_printed((pg_temp.got('s1') ->> 'id')::uuid, true);
select pg_temp.keep('o_events', to_jsonb((select array_agg(event order by id) from tally.sheet_events where sheet_id = (pg_temp.got('s1') ->> 'id')::uuid)));
select tally.save_history_item((select id from tally.item_history where name = 'GHEE 2KG'), ' ghee 2kg tin ', 'tin', 24, false);
select pg_temp.keep('o_history', (select to_jsonb(h) - array['id', 'created_at', 'updated_at', 'last_used_at', 'updated_by']
                                  from tally.item_history h where name = 'GHEE 2KG TIN'));
select pg_temp.keep('o_product_dup', to_jsonb(pg_temp.try($$
  select tally.save_history_item((select id from tally.item_history where name = 'GHEE 2KG TIN'), 'margarine 5kg', 'CTN', null, true) $$)));
select pg_temp.keep('s1_row', (select to_jsonb(s) from tally.sheets s where id = (pg_temp.got('s1') ->> 'id')::uuid));
select pg_temp.keep('s1_pallets', (select jsonb_agg(jsonb_build_array(pallet_no, item_no, plt_type, contract_no) order by pallet_no)
                                   from tally.sheet_pallets where sheet_id = (pg_temp.got('s1') ->> 'id')::uuid));

reset role;

select is(pg_temp.got('me_roles'), '["worker"]'::jsonb, 'me() lists the worker role');
select matches(pg_temp.got('s1') ->> 'ref', '^TS-\d{4}-\d{4}$', 'submit returns a TS-YYMM-NNNN reference');
select is((pg_temp.got('s1_again') ->> 'ref'), (pg_temp.got('s1') ->> 'ref'), 'resubmitting the same clientId returns the same reference');
select is((pg_temp.got('s1_again') ->> 'duplicate')::boolean, true, '... and says it was a duplicate');
select isnt((pg_temp.got('s2') ->> 'ref'), (pg_temp.got('s1') ->> 'ref'), 'a new clientId gets the next reference');
select is(pg_temp.got('bad_form') #>> '{}', '22023', 'unknown form is rejected');
select is(pg_temp.got('no_header') #>> '{}', 'ok', 'lorry sheet without a lorry no is accepted (header fields are optional)');
select is(pg_temp.got('no_plt_type') #>> '{}', '22023', 'lorry pallet without a PLT type is rejected');
select is(pg_temp.got('bad_date') #>> '{}', '22023', 'non-ISO date is rejected');
select is(pg_temp.got('bad_sig') #>> '{}', '23514', 'a signature that is not a PNG data URL is rejected');
select is(pg_temp.got('no_items') #>> '{}', '22023', 'a sheet with no items is rejected');
select is(pg_temp.got('w_sees'), '2'::jsonb, 'worker sees their own 2 sheets (duplicate not stored twice)');
select is(pg_temp.got('w_lines'), '8'::jsonb, 'worker reads the lines of their sheets');
select is(pg_temp.got('w_events'), '0'::jsonb, 'worker cannot read the activity log');
select is(pg_temp.got('w_print') #>> '{}', '42501', 'worker cannot mark printed');
select is(pg_temp.got('w_history'), '[["GHEE 2KG", "TIN", null, 2], ["MARGARINE 5KG", "CTN", 32, 2]]'::jsonb, 'submitting saves item names, unit and qty per pallet to the history');
select is(pg_temp.got('bad_unit') #>> '{}', '22023', 'an invalid unit is rejected');
select is(pg_temp.got('w_product') #>> '{}', '42501', 'worker cannot edit the item history');
select is(pg_temp.got('w_insert') #>> '{}', '42501', 'no direct table inserts');
select is(pg_temp.got('w_update') #>> '{}', '42501', 'no direct table updates');
select is(pg_temp.got('w3_sees'), '0'::jsonb, 'another worker sees none of them');
select is(pg_temp.got('w3_lines'), '0'::jsonb, '... nor their lines');
select is(pg_temp.got('w3_dup_client') #>> '{}', '23505', 'another worker cannot claim an existing clientId');
select is(pg_temp.got('norole_me'), 'null'::jsonb, 'active access without a role is not authorized');
select is(pg_temp.got('norole_submit') #>> '{}', '42501', '... and cannot submit');
select is(pg_temp.got('noaccess_sees'), '0'::jsonb, 'no access sees nothing');
select is(pg_temp.got('o_sees'), '2'::jsonb, 'office sees every sheet');
select is(pg_temp.got('o_submit') #>> '{}', '42501', 'office-only user cannot submit');
select is(pg_temp.got('o_events'), '["submitted", "printed"]'::jsonb, 'printing twice logs one printed event');
select is(pg_temp.got('o_history'), '{"name": "GHEE 2KG TIN", "unit": "TIN", "qty_per_pallet": 24, "use_count": 2, "is_active": false}'::jsonb, 'office renames and hides a history item');
select is(pg_temp.got('o_product_dup') #>> '{}', '23505', 'two history items cannot share a name');
select is(
  pg_temp.got('s1_row') - array['id', 'client_id', 'ref', 'signature', 'prepared_by', 'signed_at', 'submitted_at', 'printed_at', 'printed_by'],
  jsonb_build_object(
    'form', 'lorry', 'sheet_date', '2026-10-14', 'contract_no', null, 'container_no', null, 'seal_no', null, 'si_no', null, 'disport', null,
    'transfer_to', 'SHAH ALAM DC', 'do_no', 'DO-1', 'lorry_no', 'WXY 1', 'remark', 'OK', 'materials', '{}'::jsonb,
    'checks', '{"SAMPLE": {"qty": 2, "note": "FOR QC"}, "EMPTY CTN": {"qty": 0, "note": ""}, "OTHERS": {"qty": 3, "note": ""}}'::jsonb,
    'plt_counts', '{"L": 2, "E": 0, "C": 1, "O": 0}'::jsonb, 'total_pallets', 3, 'qty_by_unit', '{"CTN": 52, "TIN": 72}'::jsonb,
    'prepared_by_name', 'Tally Tester 1', 'device', 'pgtap', 'status', 'printed', 'printed_by_name', 'Tally Tester 2'
  ),
  'stored sheet: upper-cased text, fixed keys only, totals computed, printed'
);
select is(pg_temp.got('s1_pallets'), '[[1, 1, "L", "LS-1"], [2, 1, "C", "LS-1"], [3, 2, "L", null]]'::jsonb, 'pallets numbered 1..n across items');

select * from finish();
rollback;
