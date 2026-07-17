# Resend setup (Phase 1B)

Resend is a transactional email API with a free tier perfect for Phase 1B and beyond.

## 1. Create a Resend account (free)

1. Visit **resend.com** and sign up (free tier available).
2. Create a project (or use the default one).
3. Go to **API Keys** and create a new API key.
4. Copy the full key; it starts with `re_`.

## 2. Add to environment variables

In your `.env.local` (never commit this file):

```
RESEND_API_KEY=re_YOUR_KEY_HERE
```

## 3. Verify the setup works (Phase 1B manual testing)

During the manual testing phase (see `docs/testing-checklists/phase-1b.md`):

1. Send yourself an invitation email and check it arrived.
2. Click the activation link in the email.
3. Request a password reset and verify the email arrived.

## 4. Custom sending domain (later, optional)

By default, Resend sends from `noreply@resend.dev`. Once the platform is live,
you can add a custom sending domain (e.g. `noreply@yourdomain.com`) by adding
DNS records. See Resend documentation for details; the code in `lib/email/resend.ts`
will remain unchanged.

## Free tier limits

- 100 emails per day (more than enough for Phase 1B testing and early Phase 2).
- No daily limit on emails after that; you only pay for what you send.
- Perfect for a small roleplay community.
