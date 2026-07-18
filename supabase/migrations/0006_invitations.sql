-- ============================================================================
-- 0006_invitations.sql
-- Invitation flow: invite → send link → recipient activates with token.
-- Tokens are hashed; the plain token is only ever sent via email.
-- ============================================================================

create table public.invitations (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  token_hash        text not null unique,
  role_id           uuid not null references public.roles (id) on delete restrict,
  organisation_id   uuid not null references public.organisations (id) on delete restrict,
  office_id         uuid references public.offices (id) on delete set null,
  roblox_username   text,
  discord_username  text,
  invited_by        uuid not null references auth.users (id) on delete restrict,
  invited_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '7 days'),
  accepted_at       timestamptz,
  revoked_at        timestamptz,
  created_user_id   uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Postgres does not allow subqueries in check constraints, so office/org
-- consistency is enforced with a trigger instead.
create or replace function public.invitations_check_office_org()
returns trigger
language plpgsql
as $$
begin
  if new.office_id is not null then
    if not exists (
      select 1 from public.offices o
      where o.id = new.office_id
        and o.organisation_id = new.organisation_id
    ) then
      raise exception 'Office % does not belong to organisation %',
        new.office_id, new.organisation_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger invitations_office_org_check
  before insert or update on public.invitations
  for each row execute function public.invitations_check_office_org();

create index invitations_email_idx on public.invitations (email);
create index invitations_role_idx on public.invitations (role_id);
create index invitations_org_idx on public.invitations (organisation_id);
create index invitations_accepted_idx on public.invitations (accepted_at);
create index invitations_expires_idx on public.invitations (expires_at);

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

alter table public.invitations enable row level security;

-- No client policies: invitations are only managed by service role / admin actions.

-- Hash a token using SHA256 (one-way, cannot be reversed).
create or replace function public.hash_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(p_token, 'utf8')), 'hex');
$$;

-- Verify an invitation by its plain token (hashed on input, compared to stored).
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
  revoked boolean
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
    (inv.revoked_at is not null) as revoked
  from public.invitations inv
  where inv.token_hash = public.hash_token(p_token)
    and inv.accepted_at is null
    and inv.revoked_at is null
    and inv.expires_at > now();
end;
$$;

comment on function public.verify_invitation(text) is
  'Verify an invitation by its plain token. Returns the invitation if valid and not yet accepted or revoked. Called during activation flow.';

revoke execute on function public.verify_invitation(text) from public, anon;
grant execute on function public.verify_invitation(text) to authenticated, service_role;
