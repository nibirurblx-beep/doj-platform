-- ============================================================================
-- 0008_content.sql
-- CMS content: news posts and pages.
-- Workflow: draft -> review -> published (admins may publish directly).
-- Written by service role only; anonymous visitors read published content.
-- ============================================================================

create table public.content_posts (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('news', 'page')),
  slug            text not null,
  title           text not null,
  excerpt         text,
  body_html       text not null default '',
  status          text not null default 'draft'
                    check (status in ('draft', 'review', 'published', 'archived')),
  author_id       uuid not null references auth.users (id) on delete restrict,
  organisation_id uuid references public.organisations (id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (type, slug)
);

create index content_posts_type_status_idx on public.content_posts (type, status);
create index content_posts_published_idx on public.content_posts (published_at desc);
create index content_posts_author_idx on public.content_posts (author_id);

create trigger content_posts_set_updated_at
  before update on public.content_posts
  for each row execute function public.set_updated_at();

alter table public.content_posts enable row level security;

-- Anonymous and authenticated visitors can read published content only.
create policy content_posts_public_read
  on public.content_posts
  for select
  to anon, authenticated
  using (status = 'published');

-- No client insert/update/delete policies: all writes go through the
-- service role inside server actions, which authorise with
-- user_has_permission and write audit logs.
