-- Backfill normalized tables from legacy workspace_dashboard.payload.
-- Verification (run manually after migrate):
--   select jsonb_array_length(payload->'trainers') from workspace_dashboard where id='default';
--   select count(*) from trainers;
--   select count(*) from schedule_slots;

create or replace function public.normalize_week_key(wk text)
returns text
language plpgsql
immutable
as $$
declare
  m text[];
  y text;
  mo text;
  da text;
  iso date;
  dow int;
  diff int;
  mon date;
begin
  if wk is null or trim(wk) = '' then
    return wk;
  end if;
  m := regexp_match(trim(wk), '^(\d{4})-(\d{1,2})-(\d{1,2})$');
  if m is null then
    return trim(wk);
  end if;
  y := m[1];
  mo := lpad(m[2], 2, '0');
  da := lpad(m[3], 2, '0');
  iso := make_date(y::int, mo::int, da::int);
  dow := extract(dow from iso)::int;
  diff := extract(day from iso)::int - case when dow = 0 then 6 else dow - 1 end;
  mon := iso - diff;
  return to_char(mon, 'YYYY-MM-DD');
end;
$$;

create or replace function public.backfill_workspace_from_payload()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  wid text := 'default';
  wk text;
  wk_norm text;
  day_name text;
  slot jsonb;
  slot_id bigint;
  i int;
  tkey text;
  nlist jsonb;
  note jsonb;
  eh jsonb;
  ext jsonb;
  tr jsonb;
  te jsonb;
  cat text;
  task jsonb;
  ms jsonb;
  att_key text;
  att_val jsonb;
  md_key text;
  md_val jsonb;
  max_slot bigint := 1101;
  max_msg bigint := 200;
  max_tracker bigint := 100;
  max_task bigint := 1;
  max_ext bigint := 0;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workspace_dashboard'
  ) then
    return;
  end if;

  select payload into p
  from public.workspace_dashboard
  where id = wid;

  if p is null or p = '{}'::jsonb then
    return;
  end if;

  -- Clear normalized data (idempotent re-run)
  delete from public.attendance where workspace_id = wid;
  delete from public.tasks where workspace_id = wid;
  delete from public.msg_done where workspace_id = wid;
  delete from public.msg_slots where workspace_id = wid;
  delete from public.tracker_sync_exclusions where workspace_id = wid;
  delete from public.tracker_entries where workspace_id = wid;
  delete from public.trash_entries where workspace_id = wid;
  delete from public.extension_records where workspace_id = wid;
  delete from public.edit_history where workspace_id = wid;
  delete from public.notifications where workspace_id = wid;
  delete from public.learner_notes where workspace_id = wid;
  delete from public.deleted_slots where workspace_id = wid;
  delete from public.schedule_slots where workspace_id = wid;
  delete from public.trainers where workspace_id = wid;

  -- Trainers
  i := 0;
  for tkey in
    select jsonb_array_elements_text(coalesce(p->'trainers', '[]'::jsonb))
  loop
    insert into public.trainers (workspace_id, name, sort_order)
    values (wid, tkey, i)
    on conflict do nothing;
    i := i + 1;
  end loop;

  -- Deleted slot ids
  for slot_id in
    select (jsonb_array_elements_text(coalesce(p->'deletedSlotIds', '[]'::jsonb)))::bigint
  loop
    insert into public.deleted_slots (workspace_id, slot_id)
    values (wid, slot_id)
    on conflict do nothing;
  end loop;

  -- Schedule slots (userWeeks)
  for wk in select key from jsonb_each(coalesce(p->'userWeeks', '{}'::jsonb))
  loop
    wk_norm := public.normalize_week_key(wk);
    for day_name in select jsonb_object_keys(p->'userWeeks'->wk)
    loop
      for slot in
        select jsonb_array_elements(coalesce(p->'userWeeks'->wk->day_name, '[]'::jsonb))
      loop
        slot_id := (slot->>'id')::bigint;
        if slot_id > max_slot then max_slot := slot_id; end if;
        insert into public.schedule_slots (
          workspace_id, id, week_key, day, time, learner, trainer,
          co_trainer, type, note, added_by, added_at
        ) values (
          wid,
          slot_id,
          wk_norm,
          day_name,
          coalesce(slot->>'time', ''),
          coalesce(slot->>'learner', ''),
          coalesce(slot->>'trainer', ''),
          coalesce(slot->>'coTrainer', ''),
          coalesce(slot->>'type', 'Regular'),
          coalesce(slot->>'note', ''),
          slot->>'addedBy',
          case
            when slot->>'addedAt' is not null and slot->>'addedAt' <> ''
            then (slot->>'addedAt')::timestamptz
            else null
          end
        )
        on conflict (workspace_id, id) do update set
          week_key = excluded.week_key,
          day = excluded.day,
          time = excluded.time,
          learner = excluded.learner,
          trainer = excluded.trainer,
          co_trainer = excluded.co_trainer,
          type = excluded.type,
          note = excluded.note,
          added_by = excluded.added_by,
          added_at = excluded.added_at;
      end loop;
    end loop;
  end loop;

  -- allWeekData per week
  for wk in select key from jsonb_each(coalesce(p->'allWeekData', '{}'::jsonb))
  loop
    wk_norm := public.normalize_week_key(wk);
    -- tracker
    for te in
      select jsonb_array_elements(coalesce(p->'allWeekData'->wk->'tracker', '[]'::jsonb))
    loop
      slot_id := (te->>'id')::bigint;
      if slot_id > max_tracker then max_tracker := slot_id; end if;
      insert into public.tracker_entries (
        workspace_id, id, week_key, name, trainer, batch, week_label, target, notes
      ) values (
        wid,
        slot_id,
        wk_norm,
        coalesce(te->>'name', ''),
        te->>'trainer',
        te->>'batch',
        te->>'week',
        coalesce((te->>'target')::int, 5),
        te->>'notes'
      )
      on conflict do nothing;
    end loop;

    -- tracker exclusions
    for tkey in
      select jsonb_array_elements_text(
        coalesce(p->'allWeekData'->wk->'trackerSyncExcludedNames', '[]'::jsonb)
      )
    loop
      insert into public.tracker_sync_exclusions (workspace_id, week_key, learner_name_norm)
      values (wid, wk_norm, lower(trim(regexp_replace(regexp_replace(tkey, '[_\-()]', ' ', 'g'), '\s+', ' ', 'g'))))
      on conflict do nothing;
    end loop;

    -- msg slots per day
    for day_name in
      select unnest(array[
        'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
      ])
    loop
      for ms in
        select jsonb_array_elements(coalesce(p->'allWeekData'->wk->'msgSlots'->day_name, '[]'::jsonb))
      loop
        insert into public.msg_slots (
          workspace_id, id, week_key, day, trainer, trainers, from_time, to_time, notes
        ) values (
          wid,
          coalesce(nullif(ms->>'id', ''), 'ms' || (ms->>'id')),
          wk_norm,
          day_name,
          coalesce(ms->>'trainer', ''),
          coalesce(
            (
              select array_agg(x)
              from jsonb_array_elements_text(coalesce(ms->'trainers', '[]'::jsonb)) as t(x)
            ),
            case
              when ms->>'trainer' is not null and ms->>'trainer' <> ''
              then string_to_array(ms->>'trainer', ',')
              else '{}'::text[]
            end
          ),
          coalesce(ms->>'from', ''),
          coalesce(ms->>'to', ''),
          coalesce(ms->>'notes', '')
        )
        on conflict (workspace_id, id) do update set
          week_key = excluded.week_key,
          day = excluded.day,
          trainer = excluded.trainer,
          trainers = excluded.trainers,
          from_time = excluded.from_time,
          to_time = excluded.to_time,
          notes = excluded.notes;
      end loop;
    end loop;

    -- msg done
    for md_key, md_val in
      select key, value
      from jsonb_each(coalesce(p->'allWeekData'->wk->'msgDoneData', '{}'::jsonb))
    loop
      insert into public.msg_done (workspace_id, week_key, msg_slot_id, done, done_at)
      values (
        wid,
        wk_norm,
        md_key,
        coalesce((md_val->>'done')::boolean, false),
        md_val->>'doneAt'
      )
      on conflict do nothing;
    end loop;

    -- tasks by category
    for cat in
      select unnest(array['training','operations','marketing','admin','other'])
    loop
      for task in
        select jsonb_array_elements(coalesce(p->'allWeekData'->wk->'tasks'->cat, '[]'::jsonb))
      loop
        insert into public.tasks (
          workspace_id, id, week_key, category, name, assignee, due_date, status, delay, created_by
        ) values (
          wid,
          coalesce(task->>'id', 't' || (task->>'id')),
          wk_norm,
          cat,
          coalesce(task->>'name', ''),
          coalesce(task->>'assign', ''),
          coalesce(task->>'date', ''),
          coalesce(task->>'status', 'pending'),
          coalesce(task->>'delay', ''),
          task->>'createdBy'
        )
        on conflict do nothing;
      end loop;
    end loop;

    -- attendance
    for att_key, att_val in
      select key, value
      from jsonb_each(coalesce(p->'allWeekData'->wk->'attData', '{}'::jsonb))
    loop
      insert into public.attendance (workspace_id, week_key, slot_id, att, note)
      values (
        wid,
        wk_norm,
        att_key::bigint,
        coalesce(att_val->>'att', ''),
        coalesce(att_val->>'note', '')
      )
      on conflict do nothing;
    end loop;
  end loop;

  -- learner notes (key = slot id string)
  for tkey, nlist in
    select key, value
    from jsonb_each(coalesce(p->'learnerNotes', '{}'::jsonb))
  loop
    i := 0;
    for note in select jsonb_array_elements(nlist)
    loop
      insert into public.learner_notes (
        workspace_id, slot_id, author_email, email, trainer, text, note_ts, sort_index
      ) values (
        wid,
        tkey::bigint,
        note->>'authorEmail',
        note->>'email',
        note->>'trainer',
        coalesce(note->>'text', ''),
        note->>'ts',
        i
      );
      i := i + 1;
    end loop;
  end loop;

  -- notifications
  for tkey in
    select key from jsonb_each(coalesce(p->'notifications', '{}'::jsonb))
  loop
    for note in
      select jsonb_array_elements(coalesce(p->'notifications'->tkey, '[]'::jsonb))
    loop
      insert into public.notifications (
        workspace_id, id, trainer_key, from_email, message, ts, read,
        learner_name, to_trainer_name
      ) values (
        wid,
        coalesce(note->>'id', gen_random_uuid()::text),
        tkey,
        coalesce(note->>'from', ''),
        coalesce(note->>'msg', ''),
        coalesce(note->>'ts', ''),
        coalesce((note->>'read')::boolean, false),
        coalesce(note->>'learnerName', ''),
        coalesce(note->>'toTrainerName', '')
      )
      on conflict do nothing;
    end loop;
  end loop;

  -- edit history
  for eh in
    select jsonb_array_elements(coalesce(p->'editHistory', '[]'::jsonb))
  loop
    insert into public.edit_history (
      workspace_id, id, recorded_at, user_name, actor_email, section, action, detail
    ) values (
      wid,
      coalesce(eh->>'id', gen_random_uuid()::text),
      coalesce(eh->>'ts', ''),
      coalesce(eh->>'user', ''),
      eh->>'actorEmail',
      coalesce(eh->>'section', ''),
      coalesce(eh->>'action', ''),
      coalesce(eh->>'detail', '')
    )
    on conflict do nothing;
  end loop;

  -- extensions
  for ext in
    select jsonb_array_elements(coalesce(p->'extRecords', '[]'::jsonb))
  loop
    insert into public.extension_records (
      workspace_id, id, name, number, email, type, charges, duration,
      approved_by, reason, status, mail_sent, created_by, created_at
    ) values (
      wid,
      ext->>'id',
      coalesce(ext->>'name', ''),
      ext->>'number',
      ext->>'email',
      ext->>'type',
      ext->>'charges',
      ext->>'duration',
      ext->>'approvedBy',
      ext->>'reason',
      ext->>'status',
      coalesce((ext->>'mailSent')::boolean, false),
      ext->>'createdBy',
      case
        when ext->>'createdAt' is not null and ext->>'createdAt' <> ''
        then (ext->>'createdAt')::timestamptz
        else null
      end
    )
    on conflict do nothing;
  end loop;

  -- trash
  for tr in
    select jsonb_array_elements(coalesce(p->'trashBin', '[]'::jsonb))
  loop
    insert into public.trash_entries (
      workspace_id, id, slot_id, week_key, day, deleted_at, deleted_by,
      time, learner, trainer, co_trainer, type, note, added_by, added_at
    ) values (
      wid,
      tr->>'id',
      (tr->'slot'->>'id')::bigint,
      public.normalize_week_key(coalesce(tr->>'weekKey', '')),
      coalesce(tr->>'day', 'Monday'),
      tr->>'deletedAt',
      tr->>'deletedBy',
      coalesce(tr->'slot'->>'time', ''),
      coalesce(tr->'slot'->>'learner', ''),
      coalesce(tr->'slot'->>'trainer', ''),
      coalesce(tr->'slot'->>'coTrainer', ''),
      coalesce(tr->'slot'->>'type', 'Regular'),
      coalesce(tr->'slot'->>'note', ''),
      tr->'slot'->>'addedBy',
      case
        when tr->'slot'->>'addedAt' is not null and tr->'slot'->>'addedAt' <> ''
        then (tr->'slot'->>'addedAt')::timestamptz
        else null
      end
    )
    on conflict do nothing;
  end loop;

  -- Counters
  if coalesce((p->>'slotId')::bigint, 0) > max_slot then max_slot := (p->>'slotId')::bigint; end if;
  if coalesce((p->>'msgId')::bigint, 0) > max_msg then max_msg := (p->>'msgId')::bigint; end if;
  if coalesce((p->>'trackerId')::bigint, 0) > max_tracker then max_tracker := (p->>'trackerId')::bigint; end if;
  if coalesce((p->>'taskId')::bigint, 0) > max_task then max_task := (p->>'taskId')::bigint; end if;
  if coalesce((p->>'extId')::bigint, 0) > max_ext then max_ext := (p->>'extId')::bigint; end if;

  update public.workspace_meta set
    slot_id_counter = greatest(slot_id_counter, max_slot),
    msg_id_counter = greatest(msg_id_counter, max_msg),
    tracker_id_counter = greatest(tracker_id_counter, max_tracker),
    task_id_counter = greatest(task_id_counter, max_task),
    ext_id_counter = greatest(ext_id_counter, max_ext),
    updated_at = now()
  where workspace_id = wid;
end;
$$;

select public.backfill_workspace_from_payload();
