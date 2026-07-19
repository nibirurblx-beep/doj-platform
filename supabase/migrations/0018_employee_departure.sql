-- ============================================================================
-- 0018_employee_departure.sql
-- Employees can be marked Dismissed (fired) or Resigned (left voluntarily),
-- with when and why recorded. 'inactive' kept for backwards compatibility.
-- ============================================================================

alter table public.employees
  drop constraint if exists employees_status_check;

alter table public.employees
  add constraint employees_status_check
  check (status in ('active', 'dismissed', 'resigned', 'inactive'));

alter table public.employees
  add column if not exists ended_at timestamptz,
  add column if not exists end_reason text;
