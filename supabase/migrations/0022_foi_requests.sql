-- ============================================================================
-- 0022_foi_requests.sql
-- Freedom of Information Requests under the community's FOI act.
-- Timeline: receipt within 3 days, decision within 14, late notice may
-- extend to 30 days from submission. Denials cite statutory exemptions and
-- may be appealed once to the agency before court action.
-- ============================================================================

create table public.foi_requests (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  user_id          uuid not null references auth.users (id) on delete cascade,
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  description      text not null,
  status           text not null default 'submitted'
                     check (status in (
                       'submitted', 'acknowledged', 'needs_correction',
                       'late_notice', 'completed', 'denied',
                       'appealed', 'appeal_completed', 'appeal_denied'
                     )),
  submitted_at     timestamptz not null default now(),
  receipt_due      timestamptz not null,
  decision_due     timestamptz not null,
  extended_due     timestamptz,
  receipt_note     text,
  late_reason      text,
  decision_note    text,
  denial_exemptions text[],
  appeal_grounds   text,
  appealed_at      timestamptz,
  appeal_note      text,
  decided_at       timestamptz,
  handled_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index foi_requests_org_idx on public.foi_requests (organisation_id, status);
create index foi_requests_user_idx on public.foi_requests (user_id);

alter table public.foi_requests enable row level security;

-- Requesters can read their own requests; all writes via server code
create policy foi_requests_select_own
  on public.foi_requests for select
  using (user_id = auth.uid());

create trigger foi_requests_set_updated_at
  before update on public.foi_requests
  for each row execute function public.set_updated_at();
