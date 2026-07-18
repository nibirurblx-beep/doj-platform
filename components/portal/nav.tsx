"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/portal", label: "Dashboard", exact: true },
  { href: "/portal/settings", label: "Settings" },
];

const ADMIN_ITEM: NavItem = { href: "/portal/admin", label: "Administration" };

export function PortalNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const items = showAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <nav className="space-y-1">
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
