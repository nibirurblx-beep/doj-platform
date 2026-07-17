"use client";

import { CurrentUser } from "@/lib/auth/session";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function UserMenu({ user }: { user: CurrentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded border border-grey-200 px-3 py-2 text-sm hover:bg-grey-50"
      >
        <span>{user.displayName || user.email}</span>
        <svg
          className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded border border-grey-200 bg-white shadow-lg">
          <div className="border-b border-grey-200 p-3">
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-grey-500">{user.email}</p>
          </div>
          <Link
            href="/portal/settings"
            className="block px-3 py-2 text-sm hover:bg-grey-50"
            onClick={() => setIsOpen(false)}
          >
            Account settings
          </Link>
          <form
            action="/auth/logout"
            method="POST"
            className="border-t border-grey-200"
          >
            <button
              type="submit"
              className="w-full px-3 py-2 text-left text-sm hover:bg-grey-50"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
