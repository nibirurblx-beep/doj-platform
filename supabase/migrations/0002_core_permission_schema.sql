-- ============================================================================
-- 0002_core_permission_schema.sql
-- Organisations, offices, roles, permissions, memberships, profiles and
-- security status. This is the authorisation backbone for the whole platform.
--
-- Design rules enforced here:
--   * No single editable "role" text column anywhere.
--   * Every organisational record carries organisation_id for RLS scoping.
--   * History-bearing tables are archived, never deleted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Organisations (DOJ, MPD, FBI)
-- ----------------------------------------------------------------------------
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  short_name  text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Offices / divisions within an organisation
-- ----------------------------------------------------------------------------
create table public.offices (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  parent_office_id uuid references public.offices (id) on delete restrict,
  slug             text not null check (slug ~ '^[a-z0-9-]+$'),
  name             text not null,
  sort             integer not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organisation_id, slug),
  check (parent_office_id is distinct from id)
);

create index offices_organisation_idx on public.offices (organisation_id);

create trigger offices_set_updated_at
  before update on public.offices
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Permissions catalogue.
-- Rows are seeded from code and treated as read-only reference data at runtime.
-- ----------------------------------------------------------------------------
create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z0-9_.]+$'),
  category    text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Roles. organisation_id NULL = global role (e.g. Platform Administrator).
-- is_system roles cannot be deleted through the admin UI.
-- ----------------------------------------------------------------------------
create table public.roles (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations (id) on delete restrict,
  key             text not null check (key ~ '^[a-z0-9_-]+$'),
  name            text not null,
  description     text not null default '',
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique nulls not distinct (organisation_id, key)
);

create index roles_organisation_idx on public.roles (organisation_id);

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Role -> permission grants, with an optional scope.
-- scope semantics (used by scoped record types such as applications):
--   'own'        record belongs to the user
--   'assigned'   user is explicitly assigned to the record
--   'department' record belongs to the user's organisation
--   'all'        every organisation
-- NULL scope = the permission is unscoped (simple capability).
-- ----------------------------------------------------------------------------
create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  scope         text check (scope in ('own', 'assigned', 'department', 'all')),
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create index role_permissions_permission_idx on public.role_permissions (permission_id);

-- ----------------------------------------------------------------------------
-- Memberships: a user's belonging to an organisation.
-- A user may hold at most one membership per organisation; roles attach to
-- the membership, so multi-organisation users keep their access separated.
-- ----------------------------------------------------------------------------
create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  office_id       uuid references public.offices (id) on delete set null,
  status          text not null default 'active' check (status in ('active', 'inactive')),
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, organisation_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_organisation_idx on public.memberships (organisation_id);

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- Office must belong to the same organisation as the membership.
create or replace function public.check_membership_office()
returns trigger
language plpgsql
as $$
begin
  if new.office_id is not null then
    if not exists (
      select 1 from public.offices o
      where o.id = new.office_id
        and o.organisation_id = new.organisation_id
    ) then
      raise exception 'Office % does not belong to organisation %',
        new.office_id, new.organisation_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger memberships_check_office
  before insert or update on public.memberships
  for each row execute function public.check_membership_office();

-- ----------------------------------------------------------------------------
-- Membership -> role assignments.
-- An organisation-scoped role may only be attached to a membership of the
-- same organisation; global roles may attach to any membership.
-- ----------------------------------------------------------------------------
create table public.membership_roles (
  membership_id uuid not null references public.memberships (id) on delete cascade,
  role_id       uuid not null references public.roles (id) on delete cascade,
  granted_by    uuid references auth.users (id) on delete set null,
  granted_at    timestamptz not null default now(),
  primary key (membership_id, role_id)
);

create index membership_roles_role_idx on public.membership_roles (role_id);

create or replace function public.check_membership_role_org()
returns trigger
language plpgsql
as $$
declare
  v_role_org uuid;
  v_member_org uuid;
begin
  select organisation_id into v_role_org from public.roles where id = new.role_id;
  select organisation_id into v_member_org from public.memberships where id = new.membership_id;
  if v_role_org is not null and v_role_org is distinct from v_member_org then
    raise exception 'Role % belongs to a different organisation than membership %',
      new.role_id, new.membership_id;
  end if;
  return new;
end;
$$;

create trigger membership_roles_check_org
  before insert or update on public.membership_roles
  for each row execute function public.check_membership_role_org();

-- ----------------------------------------------------------------------------
-- Profiles: 1:1 with auth.users. Application-facing identity data.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null default '',
  roblox_username text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create an empty profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Security status: suspension and session revocation flags.
-- Read live by the permission helper so revocation is immediate.
-- ----------------------------------------------------------------------------
create table public.user_security_status (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  suspended_at        timestamptz,
  suspended_by        uuid references auth.users (id) on delete set null,
  suspension_reason   text,
  sessions_revoked_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger user_security_status_set_updated_at
  before update on public.user_security_status
  for each row execute function public.set_updated_at();
