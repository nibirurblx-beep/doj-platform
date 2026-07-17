# Phase 1B manual testing checklist

Phase 1B adds email/password authentication, invitations, password reset and
audit logging on top of Phase 1A's permission model and database schema.

## Prerequisites

You have:

- [ ] Applied migrations 0005 (audit_logs), 0006 (invitations), 0007
      (password_reset_tokens) to your Supabase project.
- [ ] Resend API key in `.env.local`.
- [ ] `NEXT_PUBLIC_SITE_URL` set correctly in `.env.local` (e.g.
      `http://localhost:3000` locally, your production domain later).
- [ ] Run `npm run build` — it should be green.

## Local dev environment

```bash
npm run dev
# http://localhost:3000
```

You should see the public home page (notice strip, header, footer). No build errors.

## Test matrix

### 1. Unauthenticated access

- [ ] Visit http://localhost:3000 → homepage loads.
- [ ] Visit http://localhost:3000/portal → redirects to `/login`.
- [ ] Visit http://localhost:3000/applicant → redirects to `/login`.
- [ ] Visit http://localhost:3000/auth/login → login form appears.

### 2. Login flow (using a real Supabase user)

You must have a real Supabase auth user to test login. Add one:

- [ ] Supabase dashboard → Authentication → Users → "Add user" → email +
      password.
- [ ] In your database, manually add a membership + roles for that user
      (use the Phase 1A bootstrap SQL as a guide, but for this test user).
- [ ] Visit `/login` locally.
- [ ] Enter the email and password → should sign in and redirect to `/portal`.
- [ ] Page shows "Welcome" and lists the organisations.
- [ ] Refresh the page → still authenticated (session persists).

### 3. Logout

- [ ] On `/portal`, click the user menu (top-right) → "Sign out".
- [ ] Should redirect to `/`.
- [ ] Visiting `/portal` again → redirected to `/login`.

### 4. Signup and invitation flow

For a realistic test, use an invitation + activation:

**As an admin (or test user with `users.invite`):**

Unfortunately, the invite endpoint arrives in Phase 1C. For Phase 1B manual
testing, simulate it in the database:

```sql
insert into public.invitations (
  email, token_hash, role_id, organisation_id,
  roblox_username, discord_username, invited_by, expires_at
)
values (
  'testuser@example.com',
  public.hash_token('test-token-12345'),
  (select id from roles where key = 'staff' and organisation_id = (select id from organisations where slug = 'doj')),
  (select id from organisations where slug = 'doj'),
  'TestRobloxUser',
  'TestDiscordUser',
  'ADMIN_USER_UUID_HERE',
  now() + interval '7 days'
)
returning id;
```

**As the invitee:**

- [ ] Visit http://localhost:3000/auth/activate?token=test-token-12345
- [ ] Form appears with fields: Display name, Roblox username, Password.
- [ ] Fill in, submit.
- [ ] Check Resend logs: invitation.accepted + account.activated appear in
      audit_logs.
- [ ] Email in Resend dashboard shows no outgoing emails (Phase 1B has no invite
      email sender yet; that arrives in Phase 1C when the UI for invitations
      goes live).
- [ ] Activate button works, creates auth user, creates membership, assigns role.
- [ ] User can then log in with email + new password.

### 5. Activation edge cases

- [ ] Invalid token → "Invalid or expired invitation link" message.
- [ ] Expired token (manually set `expires_at` to past in DB) → same error.
- [ ] Revoked invitation (set `revoked_at` to now()) → same error.
- [ ] Email already in use (sign up, then re-use email) → "Email may already be
      in use" error.

### 6. Password reset flow

- [ ] Visit `/auth/forgot-password`.
- [ ] Enter an email that has an account → "Check your email" message.
- [ ] Manually create a password reset token in the database:

```sql
insert into public.password_reset_tokens (
  user_id, token_hash, expires_at
)
values (
  'USER_UUID_HERE',
  public.hash_token('reset-token-67890'),
  now() + interval '15 minutes'
);
```

- [ ] Visit http://localhost:3000/auth/reset-password?token=reset-token-67890
- [ ] Form appears with password field.
- [ ] Enter new password, submit.
- [ ] "Password reset successful" message.
- [ ] Log out and sign in with the new password.
- [ ] Try the same reset token again → "Invalid or expired reset link" (token
      used once).

### 7. Suspension flow

- [ ] Create or log in as a test user.
- [ ] In Supabase, update `user_security_status` to add a `suspended_at`:

```sql
update public.user_security_status
set suspended_at = now(), suspension_reason = 'Test suspension'
where user_id = 'USER_UUID_HERE';
```

- [ ] While signed in, refresh the page → redirected to `/auth/suspended`.
- [ ] Try to directly visit `/portal` → redirected to `/auth/suspended`.
- [ ] Try to log in → attempt succeeds, then you're logged out immediately and
      redirected to `/auth/suspended`.

### 8. Audit logging

Every significant action logs to `audit_logs`:

```sql
select action, entity_type, created_at
from public.audit_logs
order by created_at desc
limit 10;
```

Expected actions for Phase 1B:

- `account.activated` (when someone activates via invitation link)
- `account.login` (when someone signs in)
- `account.logout` (when someone signs out)
- `password.reset.requested` (when someone requests a reset email)
- `password.reset.completed` (when someone completes the reset)
- `invitation.sent` (arrives Phase 1C)

## Known limitations accepted for this phase

- No email sending from the UI yet; invitations and password reset tokens are
  created by hand in the database. The UI and email sender for `sendInvitation()`
  arrive in Phase 1C.
- Portal and applicant pages are stubs (actual content/management arrives in
  1C onwards).
- Discord linking is stubbed (arrives Phase 1I).

## After manual testing passes

1. Update Phase 1B status in README.md to "Delivered".
2. Commit to git: `git add -A && git commit -m "Phase 1B: auth, invitations, password reset, audit logging"`.
3. Ready for Phase 1C (admin shell, CMS, invitation UI).
