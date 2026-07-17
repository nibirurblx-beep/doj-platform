-- ============================================================================
-- 0005_audit_logs.sql
-- Append-only audit trail for all significant actions.
-- Never updated or deleted; only inserted via secure functions.
-- ============================================================================

create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references auth.users (id) on delete set null,
  action          text not null check (action ~ '^[a-z0-9_.]+$'),
  entity_type     text not null check (entity_type ~ '^[a-z0-9_.]+$'),
  entity_id       uuid,
  organisation_id uuid references public.organisations (id) on delete set null,
  safe_before     jsonb,
  safe_after      jsonb,
  reason          text,
  correlation_id  text,
  user_agent      text,
  ip_address      inet,
  created_at      timestamptz not null default now(),
  check (
    action in (
      'invitation.sent',
      'invitation.revoked',
      'invitation.accepted',
      'account.activated',
      'account.login',
      'account.logout',
      'password.reset.requested',
      'password.reset.completed',
      'account.suspended',
      'account.unsuspended',
      'discord.linked',
      'discord.unlinked',
      'profile.updated'
    )
  )
);

create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_action_idx on public.audit_logs (action);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_org_idx on public.audit_logs (organisation_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

-- Audit logs are append-only and never visible to clients during Phase 1B.
-- Phase 1C wires an admin-only view policy.

-- Privileged function to insert audit rows (called from server actions only).
create or replace function public.audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_org_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_correlation_id text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, organisation_id,
    safe_before, safe_after, reason, correlation_id, user_agent
  ) values (
    auth.uid(), p_action, p_entity_type, p_entity_id, p_org_id,
    p_before, p_after, p_reason, p_correlation_id, p_user_agent
  ) returning id into v_log_id;
  return v_log_id;
end;
$$;

comment on function public.audit_log(text, text, uuid, uuid, jsonb, jsonb, text, text, text) is
  'Insert an audit log entry. Server actions only.';

revoke execute on function public.audit_log(text, text, uuid, uuid, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.audit_log(text, text, uuid, uuid, jsonb, jsonb, text, text, text)
  to service_role;
