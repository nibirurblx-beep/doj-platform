-- ============================================================================
-- 0023_reading_room_batch.sql
-- 1) New content types: press releases and case summaries (Reading Room)
-- 2) Public staff directory opt-in flag on employees
-- 3) Application interview stage
-- ============================================================================

-- 1) Content types
alter table public.content_posts drop constraint if exists content_posts_type_check;
alter table public.content_posts
  add constraint content_posts_type_check
  check (type in ('news', 'page', 'press_release', 'case_summary'));

-- 2) Staff directory opt-in (off by default; leadership toggles per employee)
alter table public.employees
  add column if not exists directory_visible boolean not null default false;

-- 3) Interview stage
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('submitted', 'under_review', 'interview', 'accepted', 'rejected', 'withdrawn'));

alter table public.applications
  add column if not exists interview_at timestamptz,
  add column if not exists interview_note text;
