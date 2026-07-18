-- ============================================================================
-- 0009_vacancies_applications.sql
-- Vacancies (admin-managed, publicly listed when open) and applications
-- (submitted by applicant accounts; ownership-based RLS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- New permissions (were not part of the original 49)
-- ----------------------------------------------------------------------------
insert into public.permissions (key, description)
values
  ('vacancies.manage', 'Create and edit vacancies and their application questions'),
  ('vacancies.publish', 'Open and close vacancies for applications')
on conflict (key) do nothing;

-- Platform Administrator automatically holds every permission at all scope:
insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.key = 'platform_administrator'
  and r.organisation_id is null
  and p.key in ('vacancies.manage', 'vacancies.publish')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Vacancies
-- ----------------------------------------------------------------------------
create table public.vacancies (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  summary          text,
  description_html text not null default '',
  questions        jsonb not null default '[]'::jsonb,
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  status           text not null default 'draft'
                     check (status in ('draft', 'open', 'closed')),
  opened_at        timestamptz,
  closed_at        timestamptz,
  created_by       uuid not null references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index vacancies_status_idx on public.vacancies (status);
create index vacancies_org_idx on public.vacancies (organisation_id);

create trigger vacancies_set_updated_at
  before update on public.vacancies
  for each row execute function public.set_updated_at();

alter table public.vacancies enable row level security;

-- The public sees open vacancies only. Admin reads happen via service role.
create policy vacancies_public_read
  on public.vacancies
  for select
  to anon, authenticated
  using (status = 'open');

-- ----------------------------------------------------------------------------
-- Application numbers: APP-YYYY-000001
-- ----------------------------------------------------------------------------
create sequence public.application_number_seq;

create or replace function public.next_application_number()
returns text
language sql
volatile
as $$
  select 'APP-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.application_number_seq')::text, 6, '0');
$$;

-- ----------------------------------------------------------------------------
-- Applications
-- ----------------------------------------------------------------------------
create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  app_number   text not null unique default public.next_application_number(),
  vacancy_id   uuid not null references public.vacancies (id) on delete restrict,
  user_id      uuid not null references auth.users (id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb,
  status       text not null default 'submitted'
                 check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (vacancy_id, user_id)
);

create index applications_user_idx on public.applications (user_id);
create index applications_vacancy_idx on public.applications (vacancy_id);
create index applications_status_idx on public.applications (status);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

alter table public.applications enable row level security;

-- Ownership-based access: applicants see their own applications only.
create policy applications_own_read
  on public.applications
  for select
  to authenticated
  using (user_id = auth.uid());

-- No client insert/update/delete: submission and withdrawal run through
-- server actions (service role) which validate answers against the vacancy's
-- questions, enforce one application per vacancy, and write audit logs.
