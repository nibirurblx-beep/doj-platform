-- ============================================================================
-- seed/0001_permissions.sql
-- The complete permissions catalogue. Idempotent.
-- Keys mirror lib/permissions/keys.ts exactly; that file is generated from
-- this list and the two must never drift.
-- ============================================================================

insert into public.permissions (key, category, description) values
  -- Public content
  ('public_content.view',                  'public',        'View published public pages'),
  ('news.view',                            'public',        'View published news and announcements'),
  ('resources.public.view',                'public',        'View public legal resources'),
  ('leadership_directory.view',            'public',        'View the public leadership directory'),

  -- Applications
  ('applications.create',                  'applications',  'Submit an application'),
  ('applications.own.view',                'applications',  'View own applications'),
  ('applications.own.update',              'applications',  'Update own draft applications'),
  ('applications.assigned.view',           'applications',  'View applications assigned to the user'),
  ('applications.department.view',         'applications',  'View applications within the organisation'),
  ('applications.all.view',                'applications',  'View applications across all organisations'),
  ('applications.review',                  'applications',  'Review applications'),
  ('applications.status.change',           'applications',  'Change application status'),
  ('applications.assign',                  'applications',  'Assign reviewers to applications'),
  ('applications.notes.internal',          'applications',  'Read and write internal application notes'),
  ('applications.background_check.manage', 'applications',  'Manage restricted background checks'),
  ('applications.checklist.manage',        'applications',  'Manage pre-employment checklists'),
  ('applications.archive',                 'applications',  'Archive applications'),

  -- Employees
  ('employees.self.view',                  'employees',     'View own employee record (approved fields)'),
  ('employees.directory.view',             'employees',     'View the internal staff directory'),
  ('employees.department.view',            'employees',     'View employee records within the organisation'),
  ('employees.all.view',                   'employees',     'View employee records across all organisations'),
  ('employees.create',                     'employees',     'Create employee records'),
  ('employees.update',                     'employees',     'Update employee records'),
  ('employees.status.manage',              'employees',     'Change employment status'),
  ('employees.rank.manage',                'employees',     'Change employee rank'),
  ('employees.roles.manage',               'employees',     'Grant or revoke roles on employees'),
  ('employees.promotion.view',             'employees',     'View promotion progress'),
  ('employees.promotion.manage',           'employees',     'Manage promotion reviews and decisions'),

  -- Documents
  ('documents.public.view',                'documents',     'View public documents'),
  ('documents.internal.view',              'documents',     'View internal documents'),
  ('documents.restricted.view',            'documents',     'View restricted documents'),
  ('documents.create',                     'documents',     'Add documents to the catalogue'),
  ('documents.update',                     'documents',     'Edit document catalogue entries'),
  ('documents.archive',                    'documents',     'Archive documents'),
  ('document_categories.manage',           'documents',     'Manage document categories'),
  ('drive_sync.manage',                    'documents',     'Configure and run Google Drive synchronisation'),

  -- Content
  ('content.create',                       'content',       'Create draft content'),
  ('content.edit',                         'content',       'Edit content'),
  ('content.submit',                       'content',       'Submit content for review'),
  ('content.publish',                      'content',       'Publish or schedule content'),
  ('content.archive',                      'content',       'Archive content'),
  ('content.categories.manage',            'content',       'Manage content categories and tags'),

  -- Administration
  ('users.invite',                         'administration','Invite new users'),
  ('users.manage',                         'administration','Manage user accounts and suspension'),
  ('roles.manage',                         'administration','Manage roles and role grants'),
  ('permissions.manage',                   'administration','Manage permission assignments'),
  ('organisations.manage',                 'administration','Manage organisations and offices'),
  ('audit_logs.view',                      'administration','View audit logs'),
  ('settings.manage',                      'administration','Manage platform settings')
on conflict (key) do nothing;

-- Vacancies (added alongside migration 0009)
insert into public.permissions (key, description)
values
  ('vacancies.manage', 'Create and edit vacancies and their application questions'),
  ('vacancies.publish', 'Open and close vacancies for applications')
on conflict (key) do nothing;
