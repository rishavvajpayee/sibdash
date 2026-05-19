-- Normalized workspace tables (replaces JSON blob storage).

-- ---------------------------------------------------------------------------
-- Meta + revision bump
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_meta (
  workspace_id text primary key default 'default',
  slot_id_counter bigint not null default 1101,
  msg_id_counter bigint not null default 200,
  tracker_id_counter bigint not null default 100,
  task_id_counter bigint not null default 1,
  ext_id_counter bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.workspace_meta (workspace_id)
values ('default')
on conflict (workspace_id) do nothing;

-- ---------------------------------------------------------------------------
-- Core entities
-- ---------------------------------------------------------------------------

create table if not exists public.trainers (
  workspace_id text not null default 'default',
  name text not null,
  sort_order int not null default 0,
  primary key (workspace_id, name)
);

create table if not exists public.schedule_slots (
  workspace_id text not null default 'default',
  id bigint not null,
  week_key text not null,
  day text not null,
  time text not null default '',
  learner text not null default '',
  trainer text not null default '',
  co_trainer text not null default '',
  type text not null default 'Regular',
  note text not null default '',
  added_by text,
  added_at timestamptz,
  primary key (workspace_id, id),
  constraint schedule_slots_day_check check (
    day in (
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    )
  )
);

create index if not exists schedule_slots_week_day_idx
  on public.schedule_slots (workspace_id, week_key, day);

create table if not exists public.deleted_slots (
  workspace_id text not null default 'default',
  slot_id bigint not null,
  primary key (workspace_id, slot_id)
);

create table if not exists public.learner_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  slot_id bigint not null,
  author_email text,
  email text,
  trainer text,
  text text not null default '',
  note_ts text,
  sort_index int not null default 0
);

create index if not exists learner_notes_slot_idx
  on public.learner_notes (workspace_id, slot_id, sort_index);

create table if not exists public.notifications (
  workspace_id text not null default 'default',
  id text not null,
  trainer_key text not null,
  from_email text not null default '',
  message text not null default '',
  ts text not null default '',
  read boolean not null default false,
  learner_name text not null default '',
  to_trainer_name text not null default '',
  primary key (workspace_id, id)
);

create index if not exists notifications_trainer_key_idx
  on public.notifications (workspace_id, trainer_key);

create table if not exists public.edit_history (
  workspace_id text not null default 'default',
  id text not null,
  recorded_at text not null default '',
  user_name text not null default '',
  actor_email text,
  section text not null default '',
  action text not null default '',
  detail text not null default '',
  primary key (workspace_id, id)
);

create index if not exists edit_history_recorded_idx
  on public.edit_history (workspace_id, id desc);

create table if not exists public.extension_records (
  workspace_id text not null default 'default',
  id text not null,
  name text not null default '',
  number text,
  email text,
  type text,
  charges text,
  duration text,
  approved_by text,
  reason text,
  status text,
  mail_sent boolean not null default false,
  created_by text,
  created_at timestamptz,
  primary key (workspace_id, id)
);

create table if not exists public.trash_entries (
  workspace_id text not null default 'default',
  id text not null,
  slot_id bigint not null,
  week_key text not null,
  day text not null,
  deleted_at text,
  deleted_by text,
  time text not null default '',
  learner text not null default '',
  trainer text not null default '',
  co_trainer text not null default '',
  type text not null default 'Regular',
  note text not null default '',
  added_by text,
  added_at timestamptz,
  primary key (workspace_id, id),
  constraint trash_entries_day_check check (
    day in (
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    )
  )
);

create table if not exists public.tracker_entries (
  workspace_id text not null default 'default',
  id bigint not null,
  week_key text not null,
  name text not null default '',
  trainer text,
  batch text,
  week_label text,
  target int not null default 5,
  notes text,
  primary key (workspace_id, id)
);

create index if not exists tracker_entries_week_idx
  on public.tracker_entries (workspace_id, week_key);

create table if not exists public.tracker_sync_exclusions (
  workspace_id text not null default 'default',
  week_key text not null,
  learner_name_norm text not null,
  primary key (workspace_id, week_key, learner_name_norm)
);

create table if not exists public.msg_slots (
  workspace_id text not null default 'default',
  id text not null,
  week_key text not null,
  day text not null,
  trainer text not null default '',
  trainers text[] not null default '{}',
  from_time text not null default '',
  to_time text not null default '',
  notes text not null default '',
  primary key (workspace_id, id),
  constraint msg_slots_day_check check (
    day in (
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    )
  )
);

create index if not exists msg_slots_week_day_idx
  on public.msg_slots (workspace_id, week_key, day);

create table if not exists public.msg_done (
  workspace_id text not null default 'default',
  week_key text not null,
  msg_slot_id text not null,
  done boolean not null default false,
  done_at text,
  primary key (workspace_id, week_key, msg_slot_id)
);

create table if not exists public.tasks (
  workspace_id text not null default 'default',
  id text not null,
  week_key text not null,
  category text not null,
  name text not null default '',
  assignee text not null default '',
  due_date text not null default '',
  status text not null default 'pending',
  delay text not null default '',
  created_by text,
  primary key (workspace_id, id),
  constraint tasks_category_check check (
    category in ('training', 'operations', 'marketing', 'admin', 'other')
  ),
  constraint tasks_status_check check (
    status in ('pending', 'inprogress', 'done')
  )
);

create index if not exists tasks_week_category_idx
  on public.tasks (workspace_id, week_key, category);

create table if not exists public.attendance (
  workspace_id text not null default 'default',
  week_key text not null,
  slot_id bigint not null,
  att text not null default '',
  note text not null default '',
  primary key (workspace_id, week_key, slot_id)
);

-- ---------------------------------------------------------------------------
-- Bump workspace_meta.updated_at on any data change
-- ---------------------------------------------------------------------------

create or replace function public.bump_workspace_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workspace_meta
  set updated_at = now()
  where workspace_id = coalesce(new.workspace_id, old.workspace_id, 'default');
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'trainers',
    'schedule_slots',
    'deleted_slots',
    'learner_notes',
    'notifications',
    'edit_history',
    'extension_records',
    'trash_entries',
    'tracker_entries',
    'tracker_sync_exclusions',
    'msg_slots',
    'msg_done',
    'tasks',
    'attendance'
  ]
  loop
    execute format(
      'drop trigger if exists bump_meta_on_%1$s on public.%1$s',
      t
    );
    execute format(
      'create trigger bump_meta_on_%1$s
       after insert or update or delete on public.%1$s
       for each row execute function public.bump_workspace_meta()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS (authenticated users, single workspace)
-- ---------------------------------------------------------------------------

alter table public.workspace_meta enable row level security;
alter table public.trainers enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.deleted_slots enable row level security;
alter table public.learner_notes enable row level security;
alter table public.notifications enable row level security;
alter table public.edit_history enable row level security;
alter table public.extension_records enable row level security;
alter table public.trash_entries enable row level security;
alter table public.tracker_entries enable row level security;
alter table public.tracker_sync_exclusions enable row level security;
alter table public.msg_slots enable row level security;
alter table public.msg_done enable row level security;
alter table public.tasks enable row level security;
alter table public.attendance enable row level security;

create policy "workspace_meta_authenticated"
  on public.workspace_meta for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "trainers_authenticated"
  on public.trainers for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "schedule_slots_authenticated"
  on public.schedule_slots for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "deleted_slots_authenticated"
  on public.deleted_slots for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "learner_notes_authenticated"
  on public.learner_notes for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "notifications_authenticated"
  on public.notifications for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "edit_history_authenticated"
  on public.edit_history for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "extension_records_authenticated"
  on public.extension_records for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "trash_entries_authenticated"
  on public.trash_entries for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "tracker_entries_authenticated"
  on public.tracker_entries for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "tracker_sync_exclusions_authenticated"
  on public.tracker_sync_exclusions for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "msg_slots_authenticated"
  on public.msg_slots for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "msg_done_authenticated"
  on public.msg_done for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "tasks_authenticated"
  on public.tasks for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');

create policy "attendance_authenticated"
  on public.attendance for all to authenticated
  using (workspace_id = 'default')
  with check (workspace_id = 'default');
