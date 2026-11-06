-- Tally Sheet: a pallet marked short by the worker (CTN damaged, taken as a
-- sample, ...). Its qty is circled in red on the sheet.
--
-- Additive. Null on pallets from before this change, whose sheets keep the old
-- marking (each item's last pallet circled); true or false from now on.
-- submit_sheet below is the definition from 20261106000000 with only short added.

alter table tally.sheet_pallets add column short boolean;

CREATE OR REPLACE FUNCTION tally.submit_sheet(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_unit       text;
  v_item_qty   int;
  v_per        int;
  v_qty_units  jsonb := '{}'::jsonb;
  v_qty        int;
  v_lines      int;
  v_header     jsonb := coalesce(p -> 'header', '{}'::jsonb);
  v_materials  jsonb := '{}'::jsonb;
  v_checks     jsonb := '{}'::jsonb;
  v_plt        jsonb := '{}'::jsonb;
  v_key        text;
  v_photo      text;
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
    -- Sample (e.g. CTN taken for QA/QC), Empty CTN, Others: a CTN count and a note.
    foreach v_key in array array['SAMPLE', 'EMPTY CTN', 'OTHERS'] loop
      v_qty := coalesce(tally.json_int(p -> 'checks' -> v_key -> 'qty'), 0);
      if v_qty < 0 or v_qty > 9999 then
        raise exception '% is out of range.', v_key using errcode = 'invalid_parameter_value';
      end if;
      v_checks := v_checks || jsonb_build_object(v_key, jsonb_build_object(
        'qty', v_qty,
        'note', coalesce(tally.clean_text(p -> 'checks' -> v_key ->> 'note', 60), '')
      ));
    end loop;
    foreach v_key in array array['L', 'L4', 'L2', 'E', 'C', 'O'] loop
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
    materials, checks, plt_counts, plt_other_note, total_pallets,
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
    v_materials, v_checks, v_plt,
    case when v_form = 'lorry' then tally.clean_text(p ->> 'pltOtherNote', 60) end,
    1,
    p ->> 'signature', v_uid, coalesce(v_name, ''),
    coalesce((p ->> 'signedAt')::timestamptz, now()),
    nullif(left(btrim(coalesce(p ->> 'device', '')), 160), '')
  )
  returning id into v_sheet_id;

  for v_item in
    select value as it, ordinality::int as item_no
    from jsonb_array_elements(p -> 'items') with ordinality
  loop
    if tally.clean_text(v_item.it ->> 'name', 80) is null then
      raise exception 'Item % has no name.', v_item.item_no using errcode = 'invalid_parameter_value';
    end if;

    v_unit := upper(btrim(coalesce(v_item.it ->> 'unit', '')));
    if v_unit = '' then v_unit := 'CTN'; end if;
    if v_unit !~ '^[A-Z0-9 .]{1,10}$' then
      raise exception 'Item % has an invalid unit.', v_item.item_no using errcode = 'invalid_parameter_value';
    end if;
    v_per := nullif(tally.json_int(v_item.it -> 'qtyPerPallet'), 0);
    v_item_qty := 0;

    insert into tally.sheet_items (sheet_id, item_no, name, unit, target_qty)
    values (v_sheet_id, v_item.item_no, tally.clean_text(v_item.it ->> 'name', 80), v_unit,
            nullif(tally.json_int(v_item.it -> 'targetQty'), 0));

    -- The shared item history workers get suggestions from.
    insert into tally.item_history (name, unit, qty_per_pallet, use_count, last_used_at)
    values (tally.clean_text(v_item.it ->> 'name', 80), v_unit, v_per, 1, now())
    on conflict (name) do update
      set unit = excluded.unit,
          qty_per_pallet = coalesce(excluded.qty_per_pallet, tally.item_history.qty_per_pallet),
          use_count = tally.item_history.use_count + 1,
          last_used_at = excluded.last_used_at,
          updated_at = now();

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

      if v_form = 'lorry' and coalesce(v_pallet.pl ->> 'pltType', '') not in ('L', 'L4', 'L2', 'E', 'C', 'O') then
        raise exception 'Pallet % needs a PLT type (L4, L2, E, C or O).', v_pallet_no using errcode = 'invalid_parameter_value';
      end if;

      -- A photo is uploaded to the caller's own folder for this sheet before submitting.
      -- A path of any other shape is refused; one that isn't in storage is left off.
      v_photo := nullif(btrim(coalesce(v_pallet.pl ->> 'photo', '')), '');
      if v_photo is not null then
        if v_photo !~ ('^' || v_uid::text || '/' || v_client_id::text || '/p[0-9]{1,3}\.jpg$') then
          raise exception 'Pallet % has an invalid photo.', v_pallet_no using errcode = 'invalid_parameter_value';
        end if;
        if not exists (select 1 from storage.objects o where o.bucket_id = 'tally-pallet-photos' and o.name = v_photo) then
          v_photo := null;
        end if;
      end if;

      insert into tally.sheet_pallets (sheet_id, pallet_no, item_no, plt_type, plt_other, contract_no, remark, photo_path, short)
      values (
        v_sheet_id, v_pallet_no, v_item.item_no,
        case when v_form = 'lorry' then v_pallet.pl ->> 'pltType' end,
        case when v_form = 'lorry' and v_pallet.pl ->> 'pltType' = 'O' then tally.clean_text(v_pallet.pl ->> 'pltOther', 20) end,
        case when v_form = 'lorry' then tally.clean_text(v_pallet.pl ->> 'contractNo', 60) end,
        tally.clean_text(v_pallet.pl ->> 'remark', 60),
        v_photo,
        -- Sent by phones from this version on; an older one leaves it null.
        case when v_pallet.pl ? 'short' then coalesce(v_pallet.pl ->> 'short', '') = 'true' end
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
        v_item_qty := v_item_qty + coalesce(v_qty, 0);
      end loop;
    end loop;

    v_qty_units := jsonb_set(v_qty_units, array[v_unit], to_jsonb(coalesce((v_qty_units ->> v_unit)::int, 0) + v_item_qty));
  end loop;

  update tally.sheets set total_pallets = v_pallet_no, qty_by_unit = v_qty_units where id = v_sheet_id;

  insert into tally.sheet_events (sheet_id, event, actor_id, actor_name) values (v_sheet_id, 'submitted', v_uid, v_name);

  return jsonb_build_object('id', v_sheet_id, 'ref', v_ref, 'duplicate', false);
end;
$function$;
