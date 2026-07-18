-- ============================================================================
-- 0011_employees.sql
-- Employee records. Created when an accepted applicant is converted to
-- staff (or manually later). Numbers look like DOJ-000001 / MPD-000001,
-- prefixed with the organisation slug, from one global sequence.
-- ============================================================================

create sequence public.employee_number_seq;

create or replace function public.next_employee_number(p_org_slug text)
returns text
language sql
volatile
as $$
  select upper(p_org_slug) || '-' ||
         lpad(nextval('public.employee_number_seq')::text, 6, '0');
$$;

create table public.employees (
  id              uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  user_id         uuid not null references auth.users (id) on delete restrict,
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  office_id       uuid references public.offices (id) on delete set null,
  rank            text,
  title           text,
  status          text not null default 'active'
                    check (status in ('active', 'inactive')),
  started_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, organisation_id)
);

create index employees_org_idx on public.employees (organisation_id);
create index employees_user_idx on public.employees (user_id);
create index employees_status_idx on public.employees (status);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

alter table public.employees enable row level security;

-- Staff can read their own employee record; everything else goes through
-- permission-checked server actions using the service role.
create policy employees_self_read
  on public.employees
  for select
  to authenticated
  using (user_id = auth.uid());
