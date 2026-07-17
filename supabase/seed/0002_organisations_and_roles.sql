-- ============================================================================
-- seed/0002_organisations_and_roles.sql
-- Organisations, system roles and role-permission grants.
-- Implements the approved permissions matrix with the CONSERVATIVE DEFAULTS
-- recorded in the architecture document:
--   * users.invite                          -> Platform Administrator only (Q9 open)
--   * applications.background_check.manage  -> Platform Administrator only (Q12 open)
--   * employees.roles.manage                -> Platform Administrator only
--   * *.all.view (cross-organisation)       -> Platform Administrator only (Q11 open)
-- Loosening any of these later is a one-line grant, so we start locked down.
--
-- Note on applicants: applicants are NOT modelled as a role here. Their
-- access (applications.create / own.view / own.update) is enforced by
-- ownership-based RLS policies on the application tables in Phase 1E
-- (user_id = auth.uid()), so an applicant account holds no memberships and
-- can never inherit staff capability by accident.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Organisations
-- ----------------------------------------------------------------------------
insert into public.organisations (slug, name, short_name) values
  ('doj', 'Department of Justice',            'DOJ'),
  ('mpd', 'Metropolitan Police Department',   'MPD'),
  ('fbi', 'Federal Bureau of Investigation',  'FBI')
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- Global role: Platform Administrator
-- ----------------------------------------------------------------------------
insert into public.roles (organisation_id, key, name, description, is_system)
values (null, 'platform_administrator', 'Platform Administrator',
        'Full access to every organisation and administrative function.', true)
on conflict do nothing;

-- Platform Administrator holds every permission, at 'all' scope.
insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.key = 'platform_administrator' and r.organisation_id is null
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Per-organisation system roles: staff, leadership, content_author
-- ----------------------------------------------------------------------------
insert into public.roles (organisation_id, key, name, description, is_system)
select o.id, v.key, v.name, v.description, true
from public.organisations o
cross join (values
  ('staff',          'Staff',          'Standard staff access within the organisation.'),
  ('leadership',     'Leadership',     'Departmental management access within the organisation.'),
  ('content_author', 'Content Author', 'May draft and submit content for the organisation.')
) as v(key, name, description)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Staff grants (per organisation)
-- ----------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from public.roles r
join (values
  ('public_content.view',         null),
  ('news.view',                   null),
  ('resources.public.view',       null),
  ('leadership_directory.view',   null),
  ('documents.public.view',       null),
  ('documents.internal.view',     null),
  ('employees.self.view',         'own'),
  ('employees.directory.view',    null),
  ('employees.promotion.view',    'own'),
  ('applications.assigned.view',  'assigned'),
  ('applications.review',         'assigned'),
  ('applications.status.change',  'assigned'),
  ('applications.notes.internal', 'assigned')
) as v(key, scope) on true
join public.permissions p on p.key = v.key
where r.key = 'staff' and r.organisation_id is not null
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Leadership grants (per organisation): everything staff has, plus
-- department-scoped management.
-- ----------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from public.roles r
join (values
  -- inherited staff baseline
  ('public_content.view',            null),
  ('news.view',                      null),
  ('resources.public.view',          null),
  ('leadership_directory.view',      null),
  ('documents.public.view',          null),
  ('documents.internal.view',        null),
  ('employees.self.view',            'own'),
  ('employees.directory.view',       null),
  -- department management
  ('applications.assigned.view',     'department'),
  ('applications.department.view',   'department'),
  ('applications.review',            'department'),
  ('applications.status.change',     'department'),
  ('applications.assign',            'department'),
  ('applications.notes.internal',    'department'),
  ('applications.checklist.manage',  'department'),
  ('applications.archive',           'department'),
  ('employees.department.view',      'department'),
  ('employees.create',               'department'),
  ('employees.update',               'department'),
  ('employees.status.manage',        'department'),
  ('employees.rank.manage',          'department'),
  ('employees.promotion.view',       'department'),
  ('employees.promotion.manage',     'department'),
  ('documents.restricted.view',      'department'),
  ('documents.create',               'department'),
  ('documents.update',               'department'),
  ('documents.archive',              'department'),
  ('document_categories.manage',     'department'),
  ('content.create',                 'department'),
  ('content.edit',                   'department'),
  ('content.submit',                 'department'),
  ('content.publish',                'department'),
  ('content.archive',                'department'),
  ('content.categories.manage',      'department'),
  ('audit_logs.view',                'department')
) as v(key, scope) on true
join public.permissions p on p.key = v.key
where r.key = 'leadership' and r.organisation_id is not null
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Content Author grants (per organisation)
-- ----------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'department'
from public.roles r
join public.permissions p on p.key in ('content.create', 'content.edit', 'content.submit')
where r.key = 'content_author' and r.organisation_id is not null
on conflict do nothing;
