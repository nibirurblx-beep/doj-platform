"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SectionTabs({
  items,
}: {
  items: Array<{ href: string; label: string; exact?: boolean }>;
}) {
  const pathname = usePathname();

  return (
    <nav className="mt-3 flex flex-wrap gap-1">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium",
              isActive
                ? "bg-navy-900 text-white shadow-sm"
                : "text-grey-700 hover:-translate-y-0.5 hover:bg-grey-100 hover:text-navy-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
