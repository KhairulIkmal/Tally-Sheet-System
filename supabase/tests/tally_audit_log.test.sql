-- pgTAP: Tally Sheet audit log (20261110000000_tally_audit_log).
-- Who may log a view or a reprint, and the 30-minute view throttle.
-- Runs inside a transaction and rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

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
create function pg_temp.keep(p_key text, p_value jsonb) returns void language sql as $$
  insert into r (k, v) values (p_key, p_value) on conflict (k) do update set v = excluded.v;
$$;
create function pg_temp.got(p_key text) returns jsonb language sql as $$ select v from r where k = p_key $$;

-- p1 worker · p2 office
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-0000-0000-0000000009a' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'tally.a' || n || '@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', 'Audit Tester ' || n), now(), now()
from generate_series(1, 2) as n;

insert into public.user_system_access (user_id, system_id, status)
select ('00000000-0000-0000-0000-0000000009a' || n)::uuid, (select id from public.systems where slug = 'tally_sheet'), 'active'
from generate_series(1, 2) as n;

insert into public.user_system_roles (user_id, system_role_id)
select u, (select sr.id from public.system_roles sr join public.systems s on s.id = sr.system_id where s.slug = 'tally_sheet' and sr.key = k)
from (values
  ('00000000-0000-0000-0000-0000000009a1'::uuid, 'worker'),
  ('00000000-0000-0000-0000-0000000009a2'::uuid, 'office')
) as v(u, k);

set local role authenticated;

-- ═══ Worker p1 submits a sheet ═══
select pg_temp.login('00000000-0000-0000-0000-0000000009a1');
select pg_temp.keep('s1', tally.submit_sheet(jsonb_build_object(
  'clientId', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'form', 'lorry', 'date', '2026-11-10',
  'header', jsonb_build_object('transferTo', 'dc', 'doNo', 'do1', 'lorryNo', 'abc 1'),
  'items', jsonb_build_array(jsonb_build_object('name', 'audit test', 'unit', 'ctn', 'targetQty', null, 'qtyPerPallet', null,
    'pallets', jsonb_build_array(jsonb_build_object('pltType', 'L4', 'contractNo', '', 'remark', '',
      'lines', jsonb_build_array(jsonb_build_object('qty', 40, 'batch', 'b', 'expired', null, 'prod', null)))))),
  'remark', '', 'signature', 'data:image/png;base64,AAAA', 'signedAt', '2026-11-10T07:00:00Z', 'device', 'pgtap')));
select pg_temp.keep('w_view', to_jsonb(pg_temp.try(format('select tally.log_sheet_event(%L, %L)', pg_temp.got('s1') ->> 'id', 'viewed'))));

-- ═══ Office p2 ═══
select pg_temp.login('00000000-0000-0000-0000-0000000009a2');
select pg_temp.keep('o_view1', to_jsonb(pg_temp.try(format('select tally.log_sheet_event(%L, %L)', pg_temp.got('s1') ->> 'id', 'viewed'))));
select pg_temp.keep('o_view2', to_jsonb(pg_temp.try(format('select tally.log_sheet_event(%L, %L)', pg_temp.got('s1') ->> 'id', 'viewed'))));
select pg_temp.keep('o_reprint_early', to_jsonb(pg_temp.try(format('select tally.log_sheet_event(%L, %L)', pg_temp.got('s1') ->> 'id', 'reprinted'))));
select tally.set_sheet_printed((pg_temp.got('s1') ->> 'id')::uuid, true);
select pg_temp.keep('o_reprint', to_jsonb(pg_temp.try(format('select tally.log_sheet_event(%L, %L)', pg_temp.got('s1') ->> 'id', 'reprinted'))));
select pg_temp.keep('o_bad', to_jsonb(pg_temp.try(format('select tally.log_sheet_event(%L, %L)', pg_temp.got('s1') ->> 'id', 'submitted'))));
select pg_temp.keep('o_missing', to_jsonb(pg_temp.try(format('select tally.log_sheet_event(%L, %L)', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'viewed'))));
select pg_temp.keep('events', (
  select jsonb_agg(jsonb_build_object('e', event, 'by', actor_name) order by id)
  from tally.sheet_events where sheet_id = (pg_temp.got('s1') ->> 'id')::uuid
));
-- Direct writes are still closed.
select pg_temp.keep('o_insert', to_jsonb(pg_temp.try(format(
  'insert into tally.sheet_events (sheet_id, event) values (%L, %L)', pg_temp.got('s1') ->> 'id', 'viewed'))));

reset role;

select is(pg_temp.got('w_view'), '"42501"'::jsonb, 'a worker cannot log a view');
select is(pg_temp.got('o_view1'), '"ok"'::jsonb, 'the office logs a view');
select is(pg_temp.got('o_view2'), '"ok"'::jsonb, 'opening it again soon after is accepted');
select is(pg_temp.got('o_reprint_early'), '"22023"'::jsonb, 'a sheet not yet printed cannot be reprinted');
select is(pg_temp.got('o_reprint'), '"ok"'::jsonb, 'a printed sheet can be logged as printed again');
select is(pg_temp.got('o_bad'), '"22023"'::jsonb, 'only viewed and reprinted can be logged this way');
select is(pg_temp.got('o_missing'), '"P0002"'::jsonb, 'an unknown sheet is refused');
select is(pg_temp.got('events'), jsonb_build_array(
  jsonb_build_object('e', 'submitted', 'by', 'Audit Tester 1'),
  jsonb_build_object('e', 'viewed', 'by', 'Audit Tester 2'),
  jsonb_build_object('e', 'printed', 'by', 'Audit Tester 2'),
  jsonb_build_object('e', 'reprinted', 'by', 'Audit Tester 2')),
  'one view per visit, then printed and printed again, each with who did it');
select is(pg_temp.got('o_insert'), '"42501"'::jsonb, 'nobody writes sheet_events directly');
select ok(exists (select 1 from pg_indexes where schemaname = 'tally' and indexname = 'sheet_events_at_idx'), 'the log is indexed by time');

select * from finish();
rollback;
