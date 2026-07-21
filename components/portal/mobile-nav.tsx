"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import type { PortalNavItem } from "./nav";

/** Burger navigation for the portal on small screens. */
export function MobilePortalNav({ items }: { items: PortalNavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="rounded border border-grey-300 p-2"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {open ? (
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          aria-label="Portal"
          className="absolute inset-x-0 top-full z-40 border-b border-grey-200 bg-white shadow-lg"
        >
          <ul className="px-3 py-2">
            {items.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded px-3 py-2.5 text-sm font-medium ${
                      isActive ? "bg-navy-50 text-navy-900" : "text-grey-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="my-1 border-t border-grey-200" />
            <li>
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="block rounded px-3 py-2.5 text-sm text-grey-600"
              >
                ← Return to main site
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
