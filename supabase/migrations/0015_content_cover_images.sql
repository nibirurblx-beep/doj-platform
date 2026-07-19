-- ============================================================================
-- 0015_content_cover_images.sql
-- Cover images for news posts and pages, stored in a PUBLIC storage
-- bucket (these images appear on the public website, so public is
-- correct here, unlike the private documents bucket).
-- ============================================================================

alter table public.content_posts
  add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  5242880, -- 5 MB per image
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
