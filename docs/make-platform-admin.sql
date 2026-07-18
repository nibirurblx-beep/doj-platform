-- ============================================================================
-- Make a user Platform Administrator
-- Run in Supabase SQL Editor. Change the email on the first line.
-- Safe to re-run: does nothing if the grant already exists.
-- ============================================================================

do $$
declare
  v_email text := 'nibirurblx@gmail.com';  -- <<< CHANGE IF NEEDED
  v_user_id uuid;
  v_org_id uuid;
  v_role_id uuid;
  v_membership_id uuid;
begin
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception 'No auth user with email %', v_email;
  end if;

  -- Anchor the membership to the DOJ organisation
  select id into v_org_id from public.organisations where slug = 'doj';
  if v_org_id is null then
    raise exception 'DOJ organisation not found - run seed 0002 first';
  end if;

  select id into v_role_id
  from public.roles
  where key = 'platform_administrator' and organisation_id is null;
  if v_role_id is null then
    raise exception 'platform_administrator role not found - run seed 0002 first';
  end if;

  insert into public.memberships (user_id, organisation_id, status)
  values (v_user_id, v_org_id, 'active')
  on conflict (user_id, organisation_id) do update set status = 'active'
  returning id into v_membership_id;

  insert into public.membership_roles (membership_id, role_id)
  values (v_membership_id, v_role_id)
  on conflict do nothing;

  raise notice 'Done: % is now Platform Administrator', v_email;
end $$;

-- Verify the grant landed:
select u.email, r.name as role
from public.membership_roles mr
join public.memberships m on m.id = mr.membership_id
join public.roles r on r.id = mr.role_id
join auth.users u on u.id = m.user_id;
