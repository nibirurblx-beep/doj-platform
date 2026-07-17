-- ============================================================================
-- tests/0001_permission_tests.sql
-- Assertion suite for the Phase 1A permission model.
--
-- Run order (local PostgreSQL):
--   1. tests/local_harness.sql
--   2. migrations/0001..0004
--   3. seed/0001, seed/0002
--   4. this file
--
-- On Supabase: run against a disposable local `supabase start` instance,
-- skipping local_harness.sql. Every block raises an exception on failure,
-- so a clean run = all tests passed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'doj.leader@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'doj.staff@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'mpd.leader@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'applicant@test.local'),
  ('00000000-0000-0000-0000-00000000000f', 'suspended.staff@test.local'),
  ('00000000-0000-0000-0000-000000000010', 'dual.member@test.local');

do $$
declare
  v_doj uuid; v_mpd uuid; v_fbi uuid;
  v_admin_role uuid;
  m uuid;
begin
  select id into v_doj from organisations where slug = 'doj';
  select id into v_mpd from organisations where slug = 'mpd';
  select id into v_fbi from organisations where slug = 'fbi';
  select id into v_admin_role from roles where key = 'platform_administrator';

  -- Platform admin (membership host org: DOJ; role is global)
  insert into memberships (user_id, organisation_id)
    values ('00000000-0000-0000-0000-00000000000a', v_doj) returning id into m;
  insert into membership_roles (membership_id, role_id) values (m, v_admin_role);

  -- DOJ leadership
  insert into memberships (user_id, organisation_id)
    values ('00000000-0000-0000-0000-00000000000b', v_doj) returning id into m;
  insert into membership_roles (membership_id, role_id)
    select m, id from roles where key = 'leadership' and organisation_id = v_doj;

  -- DOJ staff
  insert into memberships (user_id, organisation_id)
    values ('00000000-0000-0000-0000-00000000000c', v_doj) returning id into m;
  insert into membership_roles (membership_id, role_id)
    select m, id from roles where key = 'staff' and organisation_id = v_doj;

  -- MPD leadership
  insert into memberships (user_id, organisation_id)
    values ('00000000-0000-0000-0000-00000000000d', v_mpd) returning id into m;
  insert into membership_roles (membership_id, role_id)
    select m, id from roles where key = 'leadership' and organisation_id = v_mpd;

  -- Suspended DOJ staff
  insert into memberships (user_id, organisation_id)
    values ('00000000-0000-0000-0000-00000000000f', v_doj) returning id into m;
  insert into membership_roles (membership_id, role_id)
    select m, id from roles where key = 'staff' and organisation_id = v_doj;
  insert into user_security_status (user_id, suspended_at, suspension_reason)
    values ('00000000-0000-0000-0000-00000000000f', now(), 'test suspension');

  -- Dual membership: DOJ staff + FBI leadership
  insert into memberships (user_id, organisation_id)
    values ('00000000-0000-0000-0000-000000000010', v_doj) returning id into m;
  insert into membership_roles (membership_id, role_id)
    select m, id from roles where key = 'staff' and organisation_id = v_doj;
  insert into memberships (user_id, organisation_id)
    values ('00000000-0000-0000-0000-000000000010', v_fbi) returning id into m;
  insert into membership_roles (membership_id, role_id)
    select m, id from roles where key = 'leadership' and organisation_id = v_fbi;

  -- Applicant: NO membership on purpose.
end $$;

-- ----------------------------------------------------------------------------
-- T01: profile auto-creation trigger fired for every fixture user
-- ----------------------------------------------------------------------------
do $$ begin
  if (select count(*) from profiles) <> (select count(*) from auth.users) then
    raise exception 'T01 FAILED: profiles not auto-created for all users';
  end if;
  raise notice 'T01 PASSED: profile auto-creation';
end $$;

-- ----------------------------------------------------------------------------
-- T02: platform admin holds everything, everywhere
-- ----------------------------------------------------------------------------
do $$
declare v_mpd uuid;
begin
  select id into v_mpd from organisations where slug = 'mpd';
  if not user_has_permission('00000000-0000-0000-0000-00000000000a', 'settings.manage') then
    raise exception 'T02a FAILED: admin lacks settings.manage';
  end if;
  if not user_has_permission('00000000-0000-0000-0000-00000000000a', 'applications.department.view', v_mpd) then
    raise exception 'T02b FAILED: global role did not grant across organisations';
  end if;
  if not is_platform_admin('00000000-0000-0000-0000-00000000000a') then
    raise exception 'T02c FAILED: is_platform_admin false for admin';
  end if;
  raise notice 'T02 PASSED: platform administrator grants';
end $$;

-- ----------------------------------------------------------------------------
-- T03: organisation isolation — DOJ leadership has no MPD access,
--      MPD leadership has no DOJ access
-- ----------------------------------------------------------------------------
do $$
declare v_doj uuid; v_mpd uuid;
begin
  select id into v_doj from organisations where slug = 'doj';
  select id into v_mpd from organisations where slug = 'mpd';
  if not user_has_permission('00000000-0000-0000-0000-00000000000b', 'applications.department.view', v_doj) then
    raise exception 'T03a FAILED: DOJ leadership lacks own-org access';
  end if;
  if user_has_permission('00000000-0000-0000-0000-00000000000b', 'applications.department.view', v_mpd) then
    raise exception 'T03b FAILED: DOJ leadership leaked into MPD';
  end if;
  if user_has_permission('00000000-0000-0000-0000-00000000000d', 'employees.department.view', v_doj) then
    raise exception 'T03c FAILED: MPD leadership leaked into DOJ';
  end if;
  raise notice 'T03 PASSED: organisation isolation';
end $$;

-- ----------------------------------------------------------------------------
-- T04: staff vs leadership capability separation
-- ----------------------------------------------------------------------------
do $$
declare v_doj uuid;
begin
  select id into v_doj from organisations where slug = 'doj';
  if user_has_permission('00000000-0000-0000-0000-00000000000c', 'applications.assign', v_doj) then
    raise exception 'T04a FAILED: staff can assign reviewers';
  end if;
  if user_has_permission('00000000-0000-0000-0000-00000000000c', 'content.publish', v_doj) then
    raise exception 'T04b FAILED: staff can publish content';
  end if;
  if not user_has_permission('00000000-0000-0000-0000-00000000000c', 'documents.internal.view', v_doj) then
    raise exception 'T04c FAILED: staff lacks internal document view';
  end if;
  raise notice 'T04 PASSED: staff/leadership separation';
end $$;

-- ----------------------------------------------------------------------------
-- T05: conservative defaults — leadership must NOT hold locked permissions
-- ----------------------------------------------------------------------------
do $$
declare v_doj uuid;
begin
  select id into v_doj from organisations where slug = 'doj';
  if user_has_permission('00000000-0000-0000-0000-00000000000b', 'users.invite', v_doj) then
    raise exception 'T05a FAILED: leadership holds users.invite (Q9 unanswered)';
  end if;
  if user_has_permission('00000000-0000-0000-0000-00000000000b', 'applications.background_check.manage', v_doj) then
    raise exception 'T05b FAILED: leadership holds background_check.manage (Q12 unanswered)';
  end if;
  if user_has_permission('00000000-0000-0000-0000-00000000000b', 'employees.roles.manage', v_doj) then
    raise exception 'T05c FAILED: leadership holds roles.manage on employees';
  end if;
  raise notice 'T05 PASSED: conservative defaults locked to admin';
end $$;

-- ----------------------------------------------------------------------------
-- T06: suspension revokes everything immediately
-- ----------------------------------------------------------------------------
do $$
declare v_doj uuid;
begin
  select id into v_doj from organisations where slug = 'doj';
  if user_has_permission('00000000-0000-0000-0000-00000000000f', 'documents.internal.view', v_doj) then
    raise exception 'T06 FAILED: suspended user still holds permissions';
  end if;
  raise notice 'T06 PASSED: suspension revokes access';
end $$;

-- ----------------------------------------------------------------------------
-- T07: applicant (no membership) holds no staff permissions
-- ----------------------------------------------------------------------------
do $$ begin
  if user_has_permission('00000000-0000-0000-0000-00000000000e', 'documents.internal.view') then
    raise exception 'T07 FAILED: membership-less user holds staff permission';
  end if;
  raise notice 'T07 PASSED: applicant isolation';
end $$;

-- ----------------------------------------------------------------------------
-- T08: dual membership keeps organisational hats separate
-- ----------------------------------------------------------------------------
do $$
declare v_doj uuid; v_fbi uuid;
begin
  select id into v_doj from organisations where slug = 'doj';
  select id into v_fbi from organisations where slug = 'fbi';
  if not user_has_permission('00000000-0000-0000-0000-000000000010', 'applications.assign', v_fbi) then
    raise exception 'T08a FAILED: FBI leadership hat missing';
  end if;
  if user_has_permission('00000000-0000-0000-0000-000000000010', 'applications.assign', v_doj) then
    raise exception 'T08b FAILED: FBI leadership leaked into DOJ where user is only staff';
  end if;
  if user_permission_scope('00000000-0000-0000-0000-000000000010', 'applications.review', v_fbi) <> 'department' then
    raise exception 'T08c FAILED: scope resolution wrong for FBI leadership';
  end if;
  if user_permission_scope('00000000-0000-0000-0000-000000000010', 'applications.review', v_doj) <> 'assigned' then
    raise exception 'T08d FAILED: scope resolution wrong for DOJ staff hat';
  end if;
  raise notice 'T08 PASSED: dual membership separation and scope resolution';
end $$;

-- ----------------------------------------------------------------------------
-- T09: cross-organisation grant integrity trigger
-- ----------------------------------------------------------------------------
do $$
declare
  v_doj uuid; v_mpd uuid; m uuid; r uuid; failed boolean := false;
begin
  select id into v_doj from organisations where slug = 'doj';
  select id into v_mpd from organisations where slug = 'mpd';
  select id into m from memberships
    where user_id = '00000000-0000-0000-0000-00000000000c' and organisation_id = v_doj;
  select id into r from roles where key = 'leadership' and organisation_id = v_mpd;
  begin
    insert into membership_roles (membership_id, role_id) values (m, r);
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'T09 FAILED: MPD role attached to a DOJ membership';
  end if;
  raise notice 'T09 PASSED: cross-organisation role attachment rejected';
end $$;

-- ----------------------------------------------------------------------------
-- T10: RLS — anonymous users read nothing
-- ----------------------------------------------------------------------------
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from organisations;
  if n <> 0 then raise exception 'T10a FAILED: anon can read organisations'; end if;
  select count(*) into n from memberships;
  if n <> 0 then raise exception 'T10b FAILED: anon can read memberships'; end if;
  select count(*) into n from profiles;
  if n <> 0 then raise exception 'T10c FAILED: anon can read profiles'; end if;
  reset role;
  raise notice 'T10 PASSED: anonymous access denied';
end $$;

-- ----------------------------------------------------------------------------
-- T11: RLS — authenticated user sees own membership and profile, not others
-- ----------------------------------------------------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
  select count(*) into n from memberships;
  if n <> 1 then raise exception 'T11a FAILED: staff sees % memberships, expected own only', n; end if;
  select count(*) into n from profiles where id <> auth.uid();
  if n <> 0 then raise exception 'T11b FAILED: staff can read other profiles'; end if;
  select count(*) into n from organisations;
  if n < 3 then raise exception 'T11c FAILED: staff cannot read organisation reference data'; end if;
  reset role;
  raise notice 'T11 PASSED: authenticated row isolation';
end $$;

-- ----------------------------------------------------------------------------
-- T12: RLS — admin (users.manage) sees all memberships and profiles
-- ----------------------------------------------------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
  select count(*) into n from memberships;
  if n < 6 then raise exception 'T12a FAILED: admin sees only % memberships', n; end if;
  select count(*) into n from profiles;
  if n < 7 then raise exception 'T12b FAILED: admin sees only % profiles', n; end if;
  reset role;
  raise notice 'T12 PASSED: users.manage visibility';
end $$;

-- ----------------------------------------------------------------------------
-- T13: RLS — clients cannot write permission tables (no write policies)
-- ----------------------------------------------------------------------------
do $$
declare failed boolean;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
  failed := false;
  begin
    insert into organisations (slug, name, short_name) values ('rogue', 'Rogue', 'RG');
  exception when others then failed := true; end;
  if not failed then raise exception 'T13a FAILED: client inserted an organisation'; end if;

  failed := false;
  begin
    insert into membership_roles (membership_id, role_id)
    select m.id, r.id from memberships m, roles r
    where m.user_id = auth.uid() and r.key = 'platform_administrator' limit 1;
  exception when others then failed := true; end;
  if not failed then raise exception 'T13b FAILED: client granted itself platform admin'; end if;

  failed := false;
  begin
    update user_security_status set suspended_at = null;
  exception when others then failed := true; end;
  -- update with no visible rows silently affects 0 rows; verify nothing changed
  reset role;
  if exists (select 1 from user_security_status
             where user_id = '00000000-0000-0000-0000-00000000000f' and suspended_at is null) then
    raise exception 'T13c FAILED: client cleared a suspension';
  end if;
  raise notice 'T13 PASSED: privilege escalation attempts rejected';
end $$;

-- ----------------------------------------------------------------------------
-- T14: profile self-update allowed, cross-update impossible
-- ----------------------------------------------------------------------------
do $$
declare v text;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
  update profiles set display_name = 'DOJ Staff Member' where id = auth.uid();
  update profiles set display_name = 'hacked'
    where id = '00000000-0000-0000-0000-00000000000b';  -- affects 0 rows under RLS
  reset role;
  select display_name into v from profiles where id = '00000000-0000-0000-0000-00000000000c';
  if v <> 'DOJ Staff Member' then raise exception 'T14a FAILED: self-update did not apply'; end if;
  select display_name into v from profiles where id = '00000000-0000-0000-0000-00000000000b';
  if v = 'hacked' then raise exception 'T14b FAILED: cross-profile update applied'; end if;
  raise notice 'T14 PASSED: profile update boundaries';
end $$;

-- ----------------------------------------------------------------------------
-- T15: my_permissions() returns caller's own effective set only
-- ----------------------------------------------------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
  select count(*) into n from my_permissions();
  if n < 5 then raise exception 'T15a FAILED: staff effective set too small (%)', n; end if;
  if exists (select 1 from my_permissions() where permission_key = 'settings.manage') then
    raise exception 'T15b FAILED: staff effective set contains admin permission';
  end if;
  reset role;
  raise notice 'T15 PASSED: my_permissions()';
end $$;

do $$ begin
  raise notice '=== ALL PHASE 1A PERMISSION TESTS PASSED ===';
end $$;
