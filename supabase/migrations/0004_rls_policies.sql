-- ============================================================================
-- 0004_rls_policies.sql
-- Row Level Security for every Phase 1A table.
--
-- Posture for this phase:
--   * RLS is enabled on every table. No table ships without it.
--   * Reference data (organisations, offices, roles, permissions,
--     role_permissions) is readable by authenticated users so the portal can
--     render permission-aware navigation. Anonymous users get nothing.
--   * There are NO client write policies on permission tables. All writes go
--     through the service role or SECURITY DEFINER functions introduced in
--     later phases. Absence of a policy = denied.
--   * user_security_status has no client policies at all.
-- ============================================================================

alter table public.organisations        enable row level security;
alter table public.offices              enable row level security;
alter table public.permissions          enable row level security;
alter table public.roles                enable row level security;
alter table public.role_permissions     enable row level security;
alter table public.memberships          enable row level security;
alter table public.membership_roles     enable row level security;
alter table public.profiles             enable row level security;
alter table public.user_security_status enable row level security;

-- ----------------------------------------------------------------------------
-- Reference data: read-only for signed-in users.
-- ----------------------------------------------------------------------------
create policy organisations_select_authenticated
  on public.organisations for select
  to authenticated
  using (active = true or public.user_has_permission(auth.uid(), 'organisations.manage'));

create policy offices_select_authenticated
  on public.offices for select
  to authenticated
  using (active = true or public.user_has_permission(auth.uid(), 'organisations.manage'));

create policy permissions_select_authenticated
  on public.permissions for select
  to authenticated
  using (true);

create policy roles_select_authenticated
  on public.roles for select
  to authenticated
  using (true);

create policy role_permissions_select_authenticated
  on public.role_permissions for select
  to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- Memberships: users see their own; user managers see all.
-- ----------------------------------------------------------------------------
create policy memberships_select_own_or_manage
  on public.memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.user_has_permission(auth.uid(), 'users.manage')
  );

create policy membership_roles_select_own_or_manage
  on public.membership_roles for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.id = membership_id
        and (m.user_id = auth.uid()
             or public.user_has_permission(auth.uid(), 'users.manage'))
    )
  );

-- ----------------------------------------------------------------------------
-- Profiles: read own; users.manage reads all. Update own approved fields only.
-- (Directory visibility rules arrive with the employees module in 1G.)
-- ----------------------------------------------------------------------------
create policy profiles_select_own_or_manage
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.user_has_permission(auth.uid(), 'users.manage')
  );

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert/delete policies for profiles: creation happens via the
-- on_auth_user_created trigger; deletion cascades from auth.users.

-- ----------------------------------------------------------------------------
-- user_security_status: intentionally no policies. Service role and
-- SECURITY DEFINER helpers only.
-- ----------------------------------------------------------------------------
