-- ============================================================================
-- 0014_discord_linking.sql
-- Discord identity fields on profiles. Linking happens ONLY from an
-- authenticated session via OAuth; it never creates or signs in users.
-- ============================================================================

alter table public.profiles
  add column if not exists discord_id text,
  add column if not exists discord_username text,
  add column if not exists discord_linked_at timestamptz;

-- One platform account per Discord identity
create unique index if not exists profiles_discord_id_unique
  on public.profiles (discord_id)
  where discord_id is not null;
