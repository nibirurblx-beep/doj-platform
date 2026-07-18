-- ============================================================================
-- 0010_application_notes.sql
-- Internal notes on applications, visible to staff only.
-- ============================================================================

create table public.application_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id      uuid not null references auth.users (id) on delete restrict,
  body           text not null check (char_length(body) between 1 and 5000),
  created_at     timestamptz not null default now()
);

create index application_notes_application_idx
  on public.application_notes (application_id, created_at);

alter table public.application_notes enable row level security;

-- No client policies at all: applicants must never read internal notes.
-- Staff access runs through the service role inside permission-checked
-- server actions and pages.
