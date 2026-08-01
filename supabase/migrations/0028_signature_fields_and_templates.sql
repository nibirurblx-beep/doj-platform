-- ============================================================================
-- 0028_signature_fields_and_templates.sql
-- Extends signatures with a richer field model and adds document templates.
--
-- The `boxes` jsonb on signature_requests now holds mixed field types:
--   { id, page, x, y, w, h, kind, ... }
--   kind = 'signature' | 'initials' -> { signer: 'employee'|'employer' }
--   kind = 'text' | 'date'          -> { fill: 'sender'|'signer',
--                                         who: 'employee'|'employer' (for signer fill),
--                                         label, required, value }
-- Existing signature-only boxes remain valid (kind defaults handled in code).
--
-- field_values: values captured for text/date fields, keyed by field id.
--   Sender values are filled at request creation; signer values at signing.
-- ============================================================================

alter table public.signature_requests
  add column if not exists field_values jsonb not null default '{}';

-- Document templates: a reusable master PDF with pre-placed fields.
create table public.signature_templates (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid references public.organisations (id) on delete cascade,
  name             text not null,
  description      text,
  document_path    text not null,     -- path in the documents bucket (templates/…)
  fields           jsonb not null default '[]',
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index signature_templates_org_idx
  on public.signature_templates (organisation_id);

alter table public.signature_templates enable row level security;

create trigger signature_templates_set_updated_at
  before update on public.signature_templates
  for each row execute function public.set_updated_at();
