-- ============================================================================
-- 0027_fix_null_scope_inflation.sql
-- CRITICAL FIX: my_permissions() and user_permission_scope() promoted NULL
-- permission scopes to 'all', so any grant seeded without an explicit scope
-- (e.g. staff documents.internal.view) reported cross-organisation reach.
-- Visible symptom: folder restrictions in Documents were bypassed for all
-- staff. NULL now means what the seed intended: scoped to the organisation
-- of the membership that grants it.
--
-- Note: user_has_permission() (the gate for server actions and RLS writes)
-- never had this bug - no cross-organisation writes were possible.
-- ============================================================================

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
    coalesce(rp.scope, 'department') as scope
  from public.memberships m
  join public.membership_roles mr on mr.membership_id = m.id
  join public.roles r             on r.id = mr.role_id
  join public.role_permissions rp on rp.role_id = r.id
  join public.permissions p       on p.id = rp.permission_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and not public.user_is_suspended(auth.uid());
$$;

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
      coalesce(rp.scope, 'department') as scope,
      case coalesce(rp.scope, 'department')
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
  ) scopes
  order by rank desc
  limit 1;
$$;
