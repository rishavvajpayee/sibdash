-- Run after app deploy and data verification.
-- Backup first: select payload from workspace_dashboard where id = 'default';

drop table if exists public.workspace_dashboard cascade;
