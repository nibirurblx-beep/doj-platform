import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { Seal } from "@/components/brand/seal";
import { HeaderNav, type NavItem } from "./header-nav";

const DEPARTMENT_LINKS: NavItem[] = [
  { href: "/departments/doj", label: "Department of Justice" },
  { href: "/departments/mpd", label: "Metropolitan Police Department" },
  { href: "/departments/fbi", label: "Federal Bureau of Investigation" },
];

/**
 * Primary navigation = Departments dropdown + fixed sections + published
 * CMS pages (publish a page with slug "about" or "contact" and it appears
 * automatically at /p/<slug>). First four pages by title.
 */
async function getCmsItems(): Promise<NavItem[]> {
  try {
    const service = createSupabaseServiceClient();
    const { data: pages } = await service
      .from("content_posts")
      .select("slug, title")
      .eq("type", "page")
      .eq("status", "published")
      .order("title")
      .limit(4);
    return (pages ?? []).map((page) => ({
      href: `/p/${page.slug}`,
      label: page.title,
    }));
  } catch {
    return [];
  }
}

export async function SiteHeader() {
  const cmsItems = await getCmsItems();
  const items: NavItem[] = [
    { href: "/reading-room", label: "Reading Room" },
    { href: "/directory", label: "Directory" },
    { href: "/careers", label: "Careers" },
    ...cmsItems,
  ];

  return (
    <header className="relative border-b-4 border-gold-500 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Seal size={44} />
          <span className="min-w-0">
            <span className="block truncate font-display text-lg leading-tight sm:text-xl">
              Department of Justice
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-navy-100 sm:text-xs">
              OurStandingFounder's United States of America
            </span>
          </span>
        </Link>
        <HeaderNav items={items} departments={DEPARTMENT_LINKS} />
      </div>
    </header>
  );
}
