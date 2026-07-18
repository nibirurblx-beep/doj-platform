import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { Seal } from "@/components/brand/seal";

/**
 * Primary navigation = fixed sections + published CMS pages.
 * Publish a page in the admin (e.g. slug "about" or "contact") and it
 * appears here automatically at /p/<slug>. First four pages by title.
 */
async function getNavItems() {
  const fixed = [
    { href: "/news", label: "News" },
    { href: "/careers", label: "Careers" },
  ];

  try {
    const service = createSupabaseServiceClient();
    const { data: pages } = await service
      .from("content_posts")
      .select("slug, title")
      .eq("type", "page")
      .eq("status", "published")
      .order("title")
      .limit(4);

    const cmsItems = (pages ?? []).map((page) => ({
      href: `/p/${page.slug}`,
      label: page.title,
    }));
    return [...fixed, ...cmsItems];
  } catch {
    return fixed;
  }
}

export async function SiteHeader() {
  const nav = await getNavItems();

  return (
    <header className="border-b-4 border-gold-500 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-4">
          <Seal size={48} />
          <span>
            <span className="block font-display text-xl leading-tight">
              Department of Justice
            </span>
            <span className="block text-xs uppercase tracking-[0.18em] text-navy-100">
              Roleplay Community
            </span>
          </span>
        </Link>
        <nav aria-label="Primary">
          <ul className="flex flex-wrap items-center gap-6 text-sm font-medium">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="hover:text-gold-200 hover:underline hover:underline-offset-4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/auth/login"
                className="rounded border border-navy-400 px-3 py-1.5 hover:border-white"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
