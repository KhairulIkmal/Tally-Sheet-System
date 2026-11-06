-- pgTAP: Tally Sheet pallet photos (20261106000000_tally_pallet_photos).
-- Who may upload and read a photo, and how submit_sheet records it.
-- Runs inside a transaction and rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- p1 worker · p2 office · p3 second worker
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-0000-0000-0000000008a' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'tally.p' || n || '@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', 'Photo Tester ' || n), now(), now()
from generate_series(1, 3) as n;

insert into public.user_system_access (user_id, system_id, status)
select ('00000000-0000-0000-0000-0000000008a' || n)::uuid, (select id from public.systems where slug = 'tally_sheet'), 'active'
from generate_series(1, 3) as n;

insert into public.user_system_roles (user_id, system_role_id)
select u, (select sr.id from public.system_roles sr join public.systems s on s.id = sr.system_id where s.slug = 'tally_sheet' and sr.key = k)
from (values
  ('00000000-0000-0000-0000-0000000008a1'::uuid, 'worker'),
  ('00000000-0000-0000-0000-0000000008a2'::uuid, 'office'),
  ('00000000-0000-0000-0000-0000000008a3'::uuid, 'worker')
) as v(u, k);

-- A container sheet with two pallets; the first has a photo.
create function pg_temp.sheet(p_client uuid, p_photo text) returns jsonb language sql as $$
  select jsonb_build_object(
    'clientId', p_client, 'form', 'container', 'date', '2026-11-06',
    'header', jsonb_build_object('contractNo', 'c1', 'containerNo', 'tgcu 1', 'sealNo', 's1', 'siNo', 'si1', 'disport', 'pk'),
    'items', jsonb_build_array(jsonb_build_object('name', 'photo test', 'unit', 'ctn', 'targetQty', null, 'qtyPerPallet', null,
      'pallets', jsonb_build_array(
        jsonb_build_object('pltType', null, 'contractNo', '', 'remark', '', 'photo', p_photo, 'short', true,
          'lines', jsonb_build_array(jsonb_build_object('qty', 40, 'batch', 'b', 'expired', null, 'prod', null))),
        jsonb_build_object('pltType', null, 'contractNo', '', 'remark', '', 'short', false,
          'lines', jsonb_build_array(jsonb_build_object('qty', 40, 'batch', 'b', 'expired', null, 'prod', null)))))),
    'remark', '', 'signature', 'data:image/png;base64,AAAA', 'signedAt', '2026-11-06T07:00:00Z', 'device', 'pgtap'
  );
$$;

-- The uploaded photo, as Storage would have stored it.
insert into storage.objects (bucket_id, name, owner)
values ('tally-pallet-photos', '00000000-0000-0000-0000-0000000008a1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/p1.jpg', '00000000-0000-0000-0000-0000000008a1');

set local role authenticated;

-- ═══ Worker p1 ═══
select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select pg_temp.keep('up_own', to_jsonb(tally.can_upload_pallet_photo('00000000-0000-0000-0000-0000000008a1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/p3.jpg')));
select pg_temp.keep('up_other', to_jsonb(tally.can_upload_pallet_photo('00000000-0000-0000-0000-0000000008a3/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/p3.jpg')));
select pg_temp.keep('up_png', to_jsonb(tally.can_upload_pallet_photo('00000000-0000-0000-0000-0000000008a1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/p3.png')));
select pg_temp.keep('up_escape', to_jsonb(tally.can_upload_pallet_photo('00000000-0000-0000-0000-0000000008a1/../x/p3.jpg')));
select pg_temp.keep('read_own', to_jsonb(tally.can_read_pallet_photo('00000000-0000-0000-0000-0000000008a1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/p1.jpg')));
select pg_temp.keep('s1', tally.submit_sheet(pg_temp.sheet('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-0000000008a1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/p1.jpg')));
-- Not uploaded: the sheet still goes in, without the photo.
select pg_temp.keep('s2', tally.submit_sheet(pg_temp.sheet('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '00000000-0000-0000-0000-0000000008a1/cccccccc-cccc-4ccc-8ccc-cccccccccccc/p1.jpg')));
-- Someone else's folder, or another sheet's: refused.
select pg_temp.keep('bad_other', to_jsonb(pg_temp.try($$ select tally.submit_sheet(pg_temp.sheet('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '00000000-0000-0000-0000-0000000008a3/dddddddd-dddd-4ddd-8ddd-dddddddddddd/p1.jpg')) $$)));
select pg_temp.keep('bad_sheet', to_jsonb(pg_temp.try($$ select tally.submit_sheet(pg_temp.sheet('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '00000000-0000-0000-0000-0000000008a1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/p1.jpg')) $$)));
select pg_temp.keep('s1_photos', (select jsonb_agg(jsonb_build_array(pallet_no, photo_path) order by pallet_no)
  from tally.sheet_pallets where sheet_id = (pg_temp.got('s1') ->> 'id')::uuid));
select pg_temp.keep('s1_short', (select jsonb_agg(short order by pallet_no)
  from tally.sheet_pallets where sheet_id = (pg_temp.got('s1') ->> 'id')::uuid));
select pg_temp.keep('s2_photos', (select jsonb_agg(photo_path order by pallet_no)
  from tally.sheet_pallets where sheet_id = (pg_temp.got('s2') ->> 'id')::uuid));

-- Page 2: cleaned on the way in.
select pg_temp.keep('s3', tally.submit_sheet(pg_temp.sheet('ffffffff-ffff-4fff-8fff-ffffffffffff', null) || jsonb_build_object('checklist', jsonb_build_object(
  'transportAgent', ' lam soon transport ', 'qcBy', 'aina', 'department', 'qc', 'temperature', '31', 'junk', 'x',
  'container', jsonb_build_object('cleanliness', 'yes', 'noSmell', 'maybe', 'extra', 'yes'),
  'goods', jsonb_build_object('dented', 'no'),
  'packing', jsonb_build_object('lockSeal', 'yes'),
  'timeStart', '2026-11-06T01:00:00.000Z', 'timeEnd', 'not a time'))));
select pg_temp.keep('s3_cl', (select checklist from tally.sheets where id = (pg_temp.got('s3') ->> 'id')::uuid));
select pg_temp.keep('s1_cl', coalesce((select checklist from tally.sheets where id = (pg_temp.got('s1') ->> 'id')::uuid), 'null'::jsonb));

-- ═══ Second worker p3 ═══
select pg_temp.login('00000000-0000-0000-0000-0000000008a3');
select pg_temp.keep('read_other_worker', to_jsonb(tally.can_read_pallet_photo('00000000-0000-0000-0000-0000000008a1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/p1.jpg')));

-- ═══ Office p2 ═══
select pg_temp.login('00000000-0000-0000-0000-0000000008a2');
select pg_temp.keep('read_office', to_jsonb(tally.can_read_pallet_photo('00000000-0000-0000-0000-0000000008a1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/p1.jpg')));
select pg_temp.keep('up_office', to_jsonb(tally.can_upload_pallet_photo('00000000-0000-0000-0000-0000000008a2/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/p1.jpg')));
select pg_temp.keep('expired_api', to_jsonb(pg_temp.try($$ select * from tally.expired_pallet_photos() $$)));

reset role;

select is(pg_temp.got('up_own'), 'true'::jsonb, 'a worker may upload into their own folder');
select is(pg_temp.got('up_other'), 'false'::jsonb, '... not into another worker''s');
select is(pg_temp.got('up_png'), 'false'::jsonb, '... JPEG names only');
select is(pg_temp.got('up_escape'), 'false'::jsonb, '... and only the expected shape of path');
select is(pg_temp.got('up_office'), 'false'::jsonb, 'the office does not upload photos');
select is(pg_temp.got('read_own'), 'true'::jsonb, 'a worker may read their own photos');
select is(pg_temp.got('read_other_worker'), 'false'::jsonb, '... but not another worker''s');
select is(pg_temp.got('read_office'), 'true'::jsonb, 'the office may read every photo');
select is(pg_temp.got('s1_photos'),
  '[[1, "00000000-0000-0000-0000-0000000008a1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/p1.jpg"], [2, null]]'::jsonb,
  'submit records the uploaded photo on its pallet; a pallet without one has none');
select is(pg_temp.got('s1_short'), '[true, false]'::jsonb, 'a pallet marked short is stored as short');
select is(pg_temp.got('s3_cl'), jsonb_build_object(
  'transportAgent', 'LAM SOON TRANSPORT', 'pList', '', 'liftruckDriver', '', 'forkliftDriver', '', 'stackerStuffer', '',
  'qcBy', 'AINA', 'department', 'QC', 'temperature', '31',
  'container', '{"cleanliness": "yes"}'::jsonb, 'goods', '{"dented": "no"}'::jsonb, 'packing', '{"lockSeal": "yes"}'::jsonb,
  'timeStart', '2026-11-06T01:00:00.000Z', 'timeEnd', null),
  'page 2 is stored with fixed keys, YES / NO only, text in capitals, a valid start time');
select is(pg_temp.got('s1_cl'), 'null'::jsonb, 'a sheet sent without page 2 has none');
select is(pg_temp.got('s2_photos'), '[null, null]'::jsonb, 'a photo that never arrived is left off, the sheet still goes in');
select is(pg_temp.got('bad_other') #>> '{}', '22023', 'a photo in another worker''s folder is refused');
select is(pg_temp.got('bad_sheet') #>> '{}', '22023', 'a photo from another sheet''s folder is refused');
select is(pg_temp.got('expired_api') #>> '{}', '42501', 'the expiry list is not open to the API');
select is((select public from storage.buckets where id = 'tally-pallet-photos'), false, 'the photo bucket is private');

select * from finish();
rollback;
