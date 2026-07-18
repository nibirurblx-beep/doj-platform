# Deploying to Vercel (manual, no integrations)

All configuration is manual by design: no Vercel/Supabase connectors,
no integration marketplace installs.

## 1. Push to GitHub

Commit everything and push. Vercel deploys from the repository.

## 2. Import the project

1. https://vercel.com → sign in with GitHub → **Add New → Project**
2. Import the repository. Framework preset: **Next.js** (auto-detected).
3. Do NOT deploy yet — add environment variables first.

## 3. Environment variables

Project → Settings → Environment Variables. Add for Production
(and Preview if you use preview deployments):

```
NEXT_PUBLIC_SUPABASE_URL        from Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY   from Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY       from Supabase → Settings → API (secret!)
NEXT_PUBLIC_SITE_URL            https://your-domain (no trailing slash)
RESEND_API_KEY                  from resend.com
DISCORD_CLIENT_ID               from Discord developer portal
DISCORD_CLIENT_SECRET           from Discord developer portal
```

## 4. Third-party allow-lists

- **Supabase** → Authentication → URL Configuration:
  - Site URL: `https://your-domain`
  - Redirect URLs: add `https://your-domain/**`
- **Discord** → OAuth2 → Redirects: add
  `https://your-domain/auth/discord/callback`
- **Resend**: verify your sending domain to email anyone (free tier
  without a verified domain only delivers to your own address). Update
  the from address in `lib/email/resend.ts` if you change domains.

## 5. Deploy and verify

Deploy, then run through this checklist on the live URL:

- [ ] Homepage, /news, /careers load
- [ ] Sign in works; /portal loads; suspension page unreachable
- [ ] Admin area gated (open it in a private window signed out → login)
- [ ] Publish a test news post → appears on homepage
- [ ] Register a test applicant → apply → reference number issued
- [ ] Review the application → accept → convert to employee
- [ ] Documents: upload, download, delete
- [ ] Discord connect + disconnect
- [ ] Invitation email sends (requires verified Resend domain)
- [ ] Supabase → Table Editor → audit_logs shows the above with actor_id set

## Notes

- Rate limiting is in-memory per serverless instance: adequate for now,
  swap for a shared store (e.g. Upstash Redis) if the community scales.
- Security headers are set in next.config.js.
- Keep the service role key out of git and out of the browser: it lives
  only in server environment variables.
