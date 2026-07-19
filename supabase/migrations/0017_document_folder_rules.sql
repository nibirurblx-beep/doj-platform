-- ============================================================================
-- 0017_document_folder_rules.sql
-- Per-folder visibility: a row here makes the folder (and everything
-- inside it) private to one organisation. No row = visible to all staff.
-- Folder names are free; privacy is a setting, not a naming convention.
-- Managed only through server code (service role); no client policies.
-- ============================================================================

create table public.document_folder_rules (
  path            text primary key,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  updated_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now()
);

alter table public.document_folder_rules enable row level security;
