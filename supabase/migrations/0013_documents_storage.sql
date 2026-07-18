-- ============================================================================
-- 0013_documents_storage.sql
-- Private Supabase Storage bucket for the staff document repository.
-- All access runs through permission-checked server code (service role);
-- the bucket is never public and has no client storage policies.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB per file
  null      -- any type; server code applies its own checks
)
on conflict (id) do nothing;
