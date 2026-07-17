-- ============================================================================
-- 0001_extensions_and_helpers.sql
-- Extensions and shared helper functions used by all later migrations.
-- Safe to run on Supabase (PostgreSQL 15+). Idempotent where possible.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- updated_at maintenance trigger.
-- Attach to any table with an updated_at column.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Row trigger: keeps updated_at current on every UPDATE.';
