-- Shared dashboard JSON document (Firebase parity: single workspace row).
-- Run in Supabase SQL Editor or via CLI migration.

create table if not exists public.workspace_dashboard (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed row so authenticated clients can update immediately
insert into public.workspace_dashboard (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.workspace_dashboard enable row level security;

-- Authenticated users: read/write the shared workspace only
create policy "workspace_dashboard_select_authenticated"
  on public.workspace_dashboard
  for select
  to authenticated
  using (id = 'default');

create policy "workspace_dashboard_insert_authenticated"
  on public.workspace_dashboard
  for insert
  to authenticated
  with check (id = 'default');

create policy "workspace_dashboard_update_authenticated"
  on public.workspace_dashboard
  for update
  to authenticated
  using (id = 'default')
  with check (id = 'default');

-- Realtime: Supabase Dashboard → Database → Replication → enable for `workspace_dashboard`
-- (Avoids duplicate-add errors from `alter publication` in migrations.)

create index if not exists workspace_dashboard_updated_at_idx
  on public.workspace_dashboard (updated_at desc);
