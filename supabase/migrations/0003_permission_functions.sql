-- ============================================================================
-- 0003_permission_functions.sql
-- The single source of truth for authorisation decisions.
--
-- Every RLS policy and trusted server operation calls these functions.
-- They are SECURITY DEFINER so they read the permission tables with RLS
-- bypassed internally, which breaks policy recursion by design.
--
-- Suspension is checked live inside the helper, so revoking access takes
-- effect immediately regardless of JWT lifetime.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Is the user suspended?
-- ----------------------------------------------------------------------------
create or replace function public.user_is_suspended(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_security_status s
    where s.user_id = p_user
      and s.suspended_at is not null
  );
$$;

-- ----------------------------------------------------------------------------
-- Does the user hold a permission?
--
--   p_org NULL  -> "does the user hold this permission anywhere?"
--   p_org given -> "does the user hold this permission for this organisation?"
--
-- Grant resolution:
--   * Global roles (roles.organisation_id IS NULL) grant across every
--     organisation.
--   * Organisation roles grant only where the underlying membership matches
--     the requested organisation.
--   * Grants with scope 'all' also satisfy any organisation check.
--   * Inactive memberships and suspended users never grant anything.
-- ----------------------------------------------------------------------------
create or replace function public.user_has_permission(
  p_user uuid,
  p_permission text,
  p_org uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.user_is_suspended(p_user)
    and exists (
      select 1
      from public.memberships m
      join public.membership_roles mr on mr.membership_id = m.id
      join public.roles r             on r.id = mr.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p       on p.id = rp.permission_id
      where m.user_id = p_user
        and m.status = 'active'
        and p.key = p_permission
        and (
          p_org is null
          or r.organisation_id is null      -- global role
          or rp.scope = 'all'               -- explicit cross-organisation grant
          or m.organisation_id = p_org      -- grant within the requested org
        )
    );
$$;

comment on function public.user_has_permission(uuid, text, uuid) is
  'Authoritative permission check. Called by every RLS policy and trusted server operation.';

-- ----------------------------------------------------------------------------
-- Highest scope the user holds for a permission within an organisation.
-- Returns NULL when the permission is not held at all.
-- Used by scoped record types (applications, employees) in later phases.
-- ----------------------------------------------------------------------------
create or replace function public.user_permission_scope(
  p_user uuid,
  p_permission text,
  p_org uuid default null
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select scope from (
    select
      coalesce(rp.scope, 'all') as scope,
      case coalesce(rp.scope, 'all')
        when 'all' then 4
        when 'department' then 3
        when 'assigned' then 2
        when 'own' then 1
      end as rank
    from public.memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles r             on r.id = mr.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p       on p.id = rp.permission_id
    where m.user_id = p_user
      and m.status = 'active'
      and p.key = p_permission
      and not public.user_is_suspended(p_user)
      and (
        p_org is null
        or r.organisation_id is null
        or rp.scope = 'all'
        or m.organisation_id = p_org
      )
    order by rank desc
    limit 1
  ) best;
$$;

-- ----------------------------------------------------------------------------
-- Convenience: is the user a platform administrator?
-- ----------------------------------------------------------------------------
create or replace function public.is_platform_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.user_is_suspended(p_user)
    and exists (
      select 1
      from public.memberships m
      join public.membership_roles mr on mr.membership_id = m.id
      join public.roles r on r.id = mr.role_id
      where m.user_id = p_user
        and m.status = 'active'
        and r.organisation_id is null
        and r.key = 'platform_administrator'
    );
$$;

-- ----------------------------------------------------------------------------
-- Effective permission set for the current user, per organisation.
-- Powers permission-aware navigation with one query per request.
-- Only ever returns the caller's own permissions.
-- ----------------------------------------------------------------------------
create or replace function public.my_permissions()
returns table (organisation_id uuid, permission_key text, scope text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    m.organisation_id,
    p.key as permission_key,
    coalesce(rp.scope, 'all') as scope
  from public.memberships m
  join public.membership_roles mr on mr.membership_id = m.id
  join public.roles r             on r.id = mr.role_id
  join public.role_permissions rp on rp.role_id = r.id
  join public.permissions p       on p.id = rp.permission_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and not public.user_is_suspended(auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- Lock down execution. Definer functions must not be callable anonymously
-- except where a policy for anon requires them (none in Phase 1A).
-- ----------------------------------------------------------------------------
revoke execute on function public.user_is_suspended(uuid) from public, anon;
revoke execute on function public.user_has_permission(uuid, text, uuid) from public, anon;
revoke execute on function public.user_permission_scope(uuid, text, uuid) from public, anon;
revoke execute on function public.is_platform_admin(uuid) from public, anon;
revoke execute on function public.my_permissions() from public, anon;

grant execute on function public.user_is_suspended(uuid) to authenticated, service_role;
grant execute on function public.user_has_permission(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.user_permission_scope(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;
grant execute on function public.my_permissions() to authenticated, service_role;
