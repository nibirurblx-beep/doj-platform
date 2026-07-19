"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface PortalNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export function PortalNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col">
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-navy-50 text-navy-900"
                  : "text-grey-700 hover:bg-grey-50",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-6 border-t border-grey-200 pt-4">
        <Link
          href="/"
          className="block rounded px-3 py-2 text-sm text-grey-600 hover:bg-grey-50 hover:text-navy-900"
        >
          ← Return to main site
        </Link>
      </div>
    </nav>
  );
}
