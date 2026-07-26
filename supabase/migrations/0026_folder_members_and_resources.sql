-- ============================================================================
-- 0026_folder_members_and_resources.sql
-- Folder access becomes per-person: a folder is either open to all staff,
-- or restricted to an explicit list of assigned users (plus platform
-- admins). Existing department restrictions are migrated: current members
-- of the department are assigned individually, so nobody loses access.
-- ============================================================================

-- The rule row now just marks "restricted"; organisation_id becomes legacy
alter table public.document_folder_rules
  alter column organisation_id drop not null;

create table public.document_folder_members (
  path      text not null references public.document_folder_rules (path) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  added_by  uuid references auth.users (id) on delete set null,
  added_at  timestamptz not null default now(),
  primary key (path, user_id)
);

alter table public.document_folder_members enable row level security;

-- Migrate: everyone currently in the folder's department keeps access
insert into public.document_folder_members (path, user_id)
select r.path, m.user_id
from public.document_folder_rules r
join public.memberships m on m.organisation_id = r.organisation_id
where r.organisation_id is not null
on conflict do nothing;
