-- ============================================================================
-- 0024_employee_photos.sql
-- Directory photos for employees (public URLs in the public-media bucket).
-- ============================================================================

alter table public.employees
  add column if not exists photo_url text;
