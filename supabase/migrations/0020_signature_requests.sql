-- ============================================================================
-- 0020_signature_requests.sql
-- Signable documents: leadership assigns a PDF from an employee's files;
-- the staff member draws a signature; a certificate page is appended and
-- the signed copy stored alongside the original.
-- ============================================================================

create table public.signature_requests (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  document_path   text not null,
  signed_path     text,
  title           text not null,
  checklist_key   text,
  status          text not null default 'pending'
                    check (status in ('pending', 'signed', 'cancelled')),
  requested_by    uuid not null references auth.users (id) on delete restrict,
  requested_at    timestamptz not null default now(),
  signed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index signature_requests_user_idx on public.signature_requests (user_id, status);
create index signature_requests_employee_idx on public.signature_requests (employee_id);

alter table public.signature_requests enable row level security;

-- Signers may read their own requests; all writes go through server code
create policy signature_requests_select_own
  on public.signature_requests for select
  using (user_id = auth.uid());

create trigger signature_requests_set_updated_at
  before update on public.signature_requests
  for each row execute function public.set_updated_at();
