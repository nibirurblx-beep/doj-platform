# Vercel setup (manual, your account only)

No connector, CLI automation or linked account is used by this project.
Every step happens in your own Vercel dashboard.

## Phase 1A status

Deployment is optional until authentication exists (Phase 1B). If you want a
preview of the public shell now:

1. Push this repository to your GitHub account.
2. Vercel dashboard → Add New → Project → import the repository into the
   **correct** team/account.
3. Framework preset: Next.js (auto-detected). No build settings changes.
4. Environment variables: none are required for Phase 1A (the public pages
   do not touch Supabase). From Phase 1B you will add the variables in
   `.env.example`, keeping `SUPABASE_SERVICE_ROLE_KEY` and all other
   non-`NEXT_PUBLIC_` values server-side only.
5. Deploy.

## From Phase 1B onwards (do not do yet)

- Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Add the production URL to Supabase Auth redirect URLs.
- Later phases append Discord and Google variables per their setup docs.
