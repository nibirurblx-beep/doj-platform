# Phase 1A manual testing checklist

Automated coverage already executed (15/15 passing on a clean PostgreSQL 16
instance — see supabase/tests/0001_permission_tests.sql):

- [x] T01 Profile auto-creation trigger
- [x] T02 Platform administrator holds all permissions across organisations
- [x] T03 Organisation isolation (DOJ/MPD/FBI leadership cannot cross)
- [x] T04 Staff vs leadership capability separation
- [x] T05 Conservative defaults locked to admin (invite, background checks, role management)
- [x] T06 Suspension revokes all permissions immediately
- [x] T07 Membership-less user (applicant) holds no staff permissions
- [x] T08 Dual-membership user keeps organisational hats separate; scope resolution correct
- [x] T09 Cross-organisation role attachment rejected by trigger
- [x] T10 Anonymous role reads nothing
- [x] T11 Authenticated user sees only own membership/profile plus reference data
- [x] T12 users.manage sees all memberships and profiles
- [x] T13 Privilege escalation attempts rejected (org insert, self-grant admin, clear suspension)
- [x] T14 Profile self-update works; cross-profile update impossible
- [x] T15 my_permissions() returns caller's own effective set only

## Manual checks for you (local machine)

Prerequisites: Node 22+, npm.

- [ ] `npm install` completes without errors
- [ ] `npm run check:permissions` prints "Permission catalogue in sync (49 keys)"
- [ ] `npm run build` completes; routes `/`, `/disclaimer`, `/privacy` listed
- [ ] `npm run dev` then visit http://localhost:3000
  - [ ] Notice strip shows the non-affiliation line with a working
        disclaimer link
  - [ ] Header shows the seal placeholder, wordmark and navigation
  - [ ] Tab from the top of the page: the "Skip to main content" link
        appears first and works
  - [ ] Keyboard focus is clearly visible (gold outline) on every link
  - [ ] /disclaimer lists all four non-affiliations
  - [ ] Page renders sensibly at 375px width (mobile)

## Manual checks for you (your Supabase project, optional this phase)

Follow docs/setup-supabase.md, then:

- [ ] `select count(*) from permissions` returns 49
- [ ] All nine tables show "RLS enabled" in the dashboard
- [ ] Re-running both seed files changes no counts (idempotent)
- [ ] After the bootstrap-admin SQL, `is_platform_admin(<your uuid>)` = true

## Known limitations accepted for this phase

- No authentication yet: /portal and /applicant routes intentionally do not
  exist, so nothing unprotected is exposed. They arrive with middleware
  protection together in Phase 1B.
- Public pages are structural placeholders; the full editorial design and
  CMS-driven content arrive in Phase 1D.
- Webfonts not yet wired (system serif/sans fallbacks in use) — Phase 1D.
