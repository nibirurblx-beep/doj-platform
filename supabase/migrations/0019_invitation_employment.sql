-- ============================================================================
-- 0019_invitation_employment.sql
-- Invite-and-employ in one step: an invitation can carry an employment
-- flag and rank. On activation the employee record (with number) is
-- created automatically alongside the membership and role.
-- ============================================================================

alter table public.invitations
  add column if not exists create_employee boolean not null default false,
  add column if not exists employee_rank text;

-- Return the new columns from the verification function
drop function if exists public.verify_invitation(text);
create or replace function public.verify_invitation(p_token text)
returns table (
  id uuid,
  email text,
  role_id uuid,
  organisation_id uuid,
  office_id uuid,
  roblox_username text,
  discord_username text,
  invited_at timestamptz,
  revoked boolean,
  create_employee boolean,
  employee_rank text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    inv.id,
    inv.email,
    inv.role_id,
    inv.organisation_id,
    inv.office_id,
    inv.roblox_username,
    inv.discord_username,
    inv.invited_at,
    (inv.revoked_at is not null) as revoked,
    inv.create_employee,
    inv.employee_rank
  from public.invitations inv
  where inv.token_hash = public.hash_token(p_token)
    and inv.accepted_at is null
    and inv.revoked_at is null
    and inv.expires_at > now();
end;
$$;
