-- ============================================================================
-- 0021_placed_signatures.sql
-- Placeable signature boxes + employer countersignature.
-- boxes: [{page, x, y, w, h, signer: 'employee'|'employer'}] with
-- coordinates normalised 0-1 from the top-left of each page.
-- Status flow: pending (employee) -> pending_employer -> complete.
-- Legacy statuses 'signed' remains terminal.
-- ============================================================================

alter table public.signature_requests
  add column if not exists boxes jsonb not null default '[]',
  add column if not exists employer_signed_at timestamptz;

alter table public.signature_requests
  drop constraint if exists signature_requests_status_check;

alter table public.signature_requests
  add constraint signature_requests_status_check
  check (status in ('pending', 'pending_employer', 'complete', 'signed', 'cancelled'));

-- The requester (employer-side signer) may also read their requests
drop policy if exists signature_requests_select_own on public.signature_requests;
create policy signature_requests_select_own
  on public.signature_requests for select
  using (user_id = auth.uid() or requested_by = auth.uid());
