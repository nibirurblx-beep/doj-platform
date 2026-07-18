"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { href: "/portal/admin", label: "Overview", exact: true },
  { href: "/portal/admin/invitations", label: "Invitations" },
  { href: "/portal/admin/content", label: "Content" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-3 flex gap-1">
      {ADMIN_NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded px-3 py-1.5 text-sm",
              active
                ? "bg-navy-900 text-white"
                : "text-grey-600 hover:bg-grey-100 hover:text-navy-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
