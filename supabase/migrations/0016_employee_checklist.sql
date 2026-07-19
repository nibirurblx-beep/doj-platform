-- ============================================================================
-- 0016_employee_checklist.sql
-- Pre-employment checklist stored per employee. Shape:
--   { "<item_key>": { "done": true, "by": "<uuid>", "at": "<iso>" }, ... }
-- Item definitions live in code (lib/employees/checklist.ts).
-- ============================================================================

alter table public.employees
  add column if not exists checklist jsonb not null default '{}'::jsonb;
