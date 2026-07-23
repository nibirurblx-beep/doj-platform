-- ============================================================================
-- 0025_attorney_generals.sql
-- Hall of Attorney Generals: the department's AG history, managed in the
-- admin area and displayed publicly.
-- ============================================================================

create table public.attorney_generals (
  id         uuid primary key default gen_random_uuid(),
  ordinal    integer not null unique check (ordinal > 0),
  name       text not null,
  term_start date not null,
  term_end   date,
  bio        text,
  photo_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attorney_generals enable row level security;

create trigger attorney_generals_set_updated_at
  before update on public.attorney_generals
  for each row execute function public.set_updated_at();
