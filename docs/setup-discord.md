# Discord account linking setup

Free, takes ~5 minutes. Linking lets staff attach their Discord identity
to their portal account (used later for role sync and the Phase 2 bot).
It is never used to sign in.

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications (sign in with any
   Discord account, ideally the community's admin account)
2. **New Application** → name it e.g. `DOJ Portal` → Create

## 2. OAuth settings

1. Left menu → **OAuth2**
2. Copy the **Client ID**
3. Click **Reset Secret** → copy the **Client Secret**
4. Under **Redirects**, add:
   - `http://localhost:3000/auth/discord/callback` (development)
   - `https://YOUR-DOMAIN/auth/discord/callback` (add when deployed)
   Save changes.

## 3. Environment variables

Add to `.env.local` (and your host's environment settings later):

```
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
```

## 4. Restart and test

Restart the dev server → Portal → Settings → **Connect Discord** →
authorise → you land back on Settings showing "Linked as <username>".

## Behaviour and safeguards

- Linking requires an existing signed-in, non-suspended session. The
  callback never creates users or sessions.
- CSRF-protected with a one-time state cookie (10 minute expiry).
- One Discord account can be linked to only one platform account.
- Linking and unlinking are audit logged.
