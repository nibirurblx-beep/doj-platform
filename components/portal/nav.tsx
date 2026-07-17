"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/portal", label: "Dashboard", exact: true },
  { href: "/portal/settings", label: "Settings" },
] as const;

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
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
                : "text-grey-700 hover:bg-grey-50"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
