-- ============================================================================
-- 0007_password_reset_tokens.sql
-- Self-service password reset flow via email link.
-- Tokens are hashed; one-time-use; 15-minute expiry.
-- ============================================================================

create table public.password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token_hash  text not null unique,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '15 minutes')
);

create index password_reset_tokens_user_idx on public.password_reset_tokens (user_id);
create index password_reset_tokens_expires_idx on public.password_reset_tokens (expires_at);

alter table public.password_reset_tokens enable row level security;

-- No client policies: tokens are issued server-side only via route handlers.

-- Verify a password reset token by its plain token.
create or replace function public.verify_password_reset_token(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select prt.user_id into v_user_id
  from public.password_reset_tokens prt
  where prt.token_hash = public.hash_token(p_token)
    and prt.used_at is null
    and prt.expires_at > now()
  limit 1;
  return v_user_id;
end;
$$;

comment on function public.verify_password_reset_token(text) is
  'Verify a password reset token. Returns the user_id if valid and unused.';

revoke execute on function public.verify_password_reset_token(text) from public, anon, authenticated;
grant execute on function public.verify_password_reset_token(text) to service_role;

-- Mark a reset token as used (prevents reuse).
create or replace function public.use_password_reset_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.password_reset_tokens prt
  set used_at = now()
  where prt.token_hash = public.hash_token(p_token)
    and prt.used_at is null
    and prt.expires_at > now();
  return found;
end;
$$;

revoke execute on function public.use_password_reset_token(text) from public, anon, authenticated;
grant execute on function public.use_password_reset_token(text) to service_role;
