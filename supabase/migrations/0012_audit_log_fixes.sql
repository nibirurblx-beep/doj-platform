-- ============================================================================
-- 0012_audit_log_fixes.sql
-- Two fixes to the Phase 1B audit system:
--   1. The action whitelist check blocked every action name added after
--      Phase 1B (content.*, vacancy.*, application.*, employee.*), so those
--      audit inserts were silently failing. Drop the whitelist; keep the
--      format check (lowercase dotted identifiers).
--   2. audit_log() recorded auth.uid() as the actor, which is null when
--      called through the service role — i.e. in every server action.
--      Add an explicit p_actor parameter; auth.uid() still wins when present.
-- ============================================================================

-- 1. Drop the whitelist check constraint (name may vary; find it by content)
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.audit_logs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%invitation.sent%';

  if v_constraint is not null then
    execute format('alter table public.audit_logs drop constraint %I', v_constraint);
    raise notice 'Dropped constraint %', v_constraint;
  else
    raise notice 'Whitelist constraint not found (already dropped?)';
  end if;
end $$;

-- Keep/ensure the format check so action names stay tidy
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_action_format_check'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_action_format_check
      check (action ~ '^[a-z0-9_.]+$');
  end if;
end $$;

-- 2. Replace audit_log with actor-aware version (extra optional parameter;
--    existing calls keep working unchanged)
create or replace function public.audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_org_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_correlation_id text default null,
  p_user_agent text default null,
  p_actor uuid default null
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
    coalesce(auth.uid(), p_actor), p_action, p_entity_type, p_entity_id, p_org_id,
    p_before, p_after, p_reason, p_correlation_id, p_user_agent
  ) returning id into v_log_id;
  return v_log_id;
end;
$$;

revoke execute on function public.audit_log(text, text, uuid, uuid, jsonb, jsonb, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.audit_log(text, text, uuid, uuid, jsonb, jsonb, text, text, text, uuid)
  to service_role;
