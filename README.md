# DOJ Roleplay Platform

A public government-style website, applicant tracking system, employee
administration system and CMS for a Roblox United States roleplay community,
centred on its Department of Justice. Fictional; not affiliated with the
United States Government, the U.S. Department of Justice, Roblox Corporation
or Discord.

Stack: Next.js (App Router) · TypeScript strict · Tailwind CSS 4 ·
Supabase (PostgreSQL, Auth, RLS) · Google Drive (documents) · Discord OAuth.

**All Vercel, Supabase, Google and Discord configuration is a manual process
performed by the project owner in their own accounts. See `docs/`. No
connectors or linked accounts are used at any stage.**

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1A | Foundations: scaffold, design tokens, permission schema, RLS, seeds, tests | **Delivered** |
| 1B | Authentication, invitations, suspension, audit core, middleware | Not started |
| 1C | Admin shell | Not started |
| 1D | CMS + public design pass | Not started |
| 1E | Vacancies + applicant flow | Not started |
| 1F | Application administration | Not started |
| 1G | Employees + conversion | Not started |
| 1H | Google Drive documents | Not started |
| 1I | Discord linking + login | Not started |
| 1J | Hardening + handover | Not started |

## Local development

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build (must stay green)
npm run check:permissions  # seed SQL <-> keys.ts drift check
```

Supabase environment variables are not needed until Phase 1B; copy
`.env.example` to `.env.local` when they are.

## Database testing (no Supabase account required)

The permission model is fully testable on plain PostgreSQL:

```bash
createdb dojtest
psql -d dojtest -v ON_ERROR_STOP=1 \
  -f supabase/tests/local_harness.sql \
  -f supabase/migrations/0001_extensions_and_helpers.sql \
  -f supabase/migrations/0002_core_permission_schema.sql \
  -f supabase/migrations/0003_permission_functions.sql \
  -f supabase/migrations/0004_rls_policies.sql \
  -f supabase/seed/0001_permissions.sql \
  -f supabase/seed/0002_organisations_and_roles.sql \
  -f supabase/tests/0001_permission_tests.sql
```

A clean run ends with `ALL PHASE 1A PERMISSION TESTS PASSED`.
`local_harness.sql` mocks the Supabase auth schema and API roles — never run
it against a real Supabase project.

## File tree (Phase 1A)

```
doj-platform/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx            # notice strip + header + footer shell
│   │   ├── page.tsx              # placeholder editorial home
│   │   ├── disclaimer/page.tsx   # non-affiliation statement
│   │   └── privacy/page.tsx      # privacy notice stub
│   ├── globals.css               # design tokens (navy/gold/grey/red, type)
│   └── layout.tsx                # root layout, en-GB, metadata
├── components/
│   └── public/
│       ├── notice-strip.tsx
│       ├── site-header.tsx       # seal area pending branding (Q2)
│       └── site-footer.tsx
├── lib/
│   ├── db/
│   │   ├── client.ts             # browser client (anon key, RLS)
│   │   └── server.ts             # user-scoped + service-role clients
│   ├── permissions/keys.ts       # permission constants (mirrors seed)
│   └── utils.ts                  # cn()
├── scripts/
│   └── check-permissions-sync.mjs
├── supabase/
│   ├── migrations/
│   │   ├── 0001_extensions_and_helpers.sql
│   │   ├── 0002_core_permission_schema.sql   # orgs/offices/roles/permissions/
│   │   │                                     # memberships/profiles/security
│   │   ├── 0003_permission_functions.sql     # user_has_permission etc.
│   │   └── 0004_rls_policies.sql
│   ├── seed/
│   │   ├── 0001_permissions.sql              # 49-key catalogue
│   │   └── 0002_organisations_and_roles.sql  # DOJ/MPD/FBI + system roles
│   └── tests/
│       ├── local_harness.sql                 # LOCAL ONLY auth mock
│       └── 0001_permission_tests.sql         # 15 assertions, all passing
├── docs/
│   ├── setup-supabase.md
│   ├── setup-vercel.md
│   ├── setup-discord.md          # placeholder until Phase 1I
│   ├── setup-google-drive.md     # placeholder until Phase 1H
│   └── testing-checklists/phase-1a.md
├── .env.example
├── next.config.ts · postcss.config.mjs · tsconfig.json · package.json
```

---

## Phase 1B: Authentication and invitations

**Status: Delivered** (Phase 1A + 1B = 31 files, 20 routes)

### What's new in 1B

- Email/password authentication via Supabase Auth
- Invitation flow with one-time activation links (7-day expiry)
- Self-serve password reset via email
- Account suspension (immediate, revokes all access live)
- Transactional email via Resend (free tier)
- Session management with middleware protection
- Audit logging for all auth events
- `/portal` and `/applicant` protected routes
- Discord OAuth plumbed and ready (Phase 1I)

### Database

Three new migrations:
- `0005_audit_logs.sql` — append-only audit trail, never edited/deleted
- `0006_invitations.sql` — secure, hashed, one-time-use tokens
- `0007_password_reset_tokens.sql` — short-lived (15 min) reset tokens

### Auth pages

- `/login` — email + password sign-in
- `/auth/activate?token=...` — invitation acceptance with profile setup
- `/auth/forgot-password` — request reset email
- `/auth/reset-password?token=...` — password reset form
- `/auth/suspended` — account suspended notice
- `/auth/callback` — OAuth ready (empty until Phase 1I)
- `/auth/logout` — sign out (POST)

### Portal shell

- `/portal` — protected dashboard (stub, full content Phase 1C+)
- `/portal/settings` — account settings + connections stub (Discord Phase 1I)
- Responsive sidebar nav + user menu with logout
- Session refresh on every request via middleware

### Applicant shell

- `/applicant` — protected overview (stub, application tracking Phase 1E)

### Setup & testing

- `docs/setup-resend.md` — free Resend account + API key setup
- `docs/testing-checklists/phase-1b.md` — complete manual test matrix including
  suspension, audit logging, edge cases

### Known limitations

- Invitations and password resets created by hand in DB (Phase 1B manual testing).
  The UI + email sender for `sendInvitation()` arrive in Phase 1C.
- Portal / applicant content are stubs.
- Discord linking stubbed (Phase 1I).

### To deploy Phase 1B

1. Apply migrations 0005, 0006, 0007 to Supabase.
2. Set `RESEND_API_KEY` in Vercel environment variables.
3. Redeploy.
4. Follow `docs/testing-checklists/phase-1b.md` for manual testing.

