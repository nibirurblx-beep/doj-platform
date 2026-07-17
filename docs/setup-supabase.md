# Supabase setup (manual, your account only)

Every step here happens in **your** Supabase account through the dashboard or
the Supabase CLI linked to **your** project ref. Nothing in this project ever
connects to Supabase automatically, and no connector is used at any stage.

## 1. Create the project (once)

1. Sign in at supabase.com with the correct account for this project.
2. Create a new project in the correct organisation.
3. Choose a region close to your player base (e.g. `eu-west-2` London or
   `us-east-1` depending on the community).
4. Set a strong database password and store it in your password manager.
5. From **Project Settings → API**, record:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never
     shared, never prefixed `NEXT_PUBLIC_`)

## 2. Apply migrations (Phase 1A: four files)

Run these **in order** in the SQL Editor (Dashboard → SQL Editor → New
query, paste the whole file, Run):

1. `supabase/migrations/0001_extensions_and_helpers.sql`
2. `supabase/migrations/0002_core_permission_schema.sql`
3. `supabase/migrations/0003_permission_functions.sql`
4. `supabase/migrations/0004_rls_policies.sql`

Then the seeds, also in order:

5. `supabase/seed/0001_permissions.sql`
6. `supabase/seed/0002_organisations_and_roles.sql`

Both seed files are idempotent: re-running them is safe.

CLI alternative (optional): install the Supabase CLI, `supabase login`,
`supabase link --project-ref <YOUR_REF>`, then `supabase db push`.

> Do **not** run `supabase/tests/local_harness.sql` against a real project.
> It exists only to mock the auth schema on a plain local PostgreSQL.

## 3. Verify Phase 1A

In the SQL Editor:

```sql
select count(*) from public.permissions;      -- expect 49
select slug from public.organisations;        -- expect doj, mpd, fbi
select key, organisation_id is null as global
from public.roles order by global desc, key;  -- platform_administrator + 3x3 org roles
```

Confirm RLS is on for every table: Dashboard → Database → Tables → each
table shows "RLS enabled".

## 4. Bootstrap your own admin account (temporary, Phase 1A only)

Invitation flows arrive in Phase 1B. Until then, create the first
administrator by hand:

1. Dashboard → Authentication → Users → **Add user** → your email +
   password (or "Send invitation").
2. Copy the new user's UUID.
3. SQL Editor:

```sql
with me as (select 'PASTE-YOUR-USER-UUID'::uuid as id),
     doj as (select id from public.organisations where slug = 'doj'),
     admin_role as (select id from public.roles
                    where key = 'platform_administrator'
                      and organisation_id is null),
     m as (
       insert into public.memberships (user_id, organisation_id)
       select me.id, doj.id from me, doj
       on conflict (user_id, organisation_id) do update set status = 'active'
       returning id
     )
insert into public.membership_roles (membership_id, role_id)
select m.id, admin_role.id from m, admin_role
on conflict do nothing;
```

4. Verify: `select public.is_platform_admin('PASTE-YOUR-USER-UUID');`
   should return `true`.

## 5. Auth settings (prepare now, used from Phase 1B)

Dashboard → Authentication → Providers / URL Configuration:

- Site URL: `http://localhost:3000` for now; add the production URL after
  the first Vercel deployment.
- Redirect URLs: `http://localhost:3000/auth/callback`.
- **Disable public sign-ups** (Authentication → Providers → Email →
  "Allow new users to sign up" OFF). Staff accounts are invitation-only;
  applicant sign-up is handled by a controlled server flow in Phase 1E.
- Leave Discord OFF until Phase 1I (see `setup-discord.md`).

## 6. Free-tier safeguards (do these now)

- **Pause prevention:** free projects pause after ~7 days of inactivity.
  Until the site has steady traffic, open the dashboard weekly, or set up a
  scheduled ping once the app is deployed.
- **Backups:** the free tier has no automatic backups. Weekly, run
  (Supabase CLI installed and linked):

  ```bash
  supabase db dump -f backup-$(date +%Y%m%d).sql
  ```

  and keep the file somewhere safe that is not the same Supabase project.
