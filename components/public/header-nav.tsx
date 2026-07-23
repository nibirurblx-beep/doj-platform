"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/client";

interface AuthState {
  loaded: boolean;
  name: string | null;
  isStaff: boolean;
}

/** Signed-in status for the public header. RLS: own profile + own memberships. */
function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({
    loaded: false,
    name: null,
    isStaff: false,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setState({ loaded: true, name: null, isStaff: false });
        return;
      }
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).single(),
        supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      if (!cancelled) {
        setState({
          loaded: true,
          name: profile?.display_name || user.email || "Account",
          isStaff: (count ?? 0) > 0,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function AuthLinks({ auth, mobile }: { auth: AuthState; mobile?: boolean }) {
  if (!auth.loaded || !auth.name) {
    return (
      <Link
        href="/auth/login"
        className={
          mobile
            ? "block rounded border border-navy-400 px-3 py-2 text-center text-sm"
            : "rounded border border-navy-400 px-3 py-1.5 hover:border-white"
        }
      >
        Sign in
      </Link>
    );
  }

  const destination = auth.isStaff
    ? { href: "/portal", label: "Staff portal" }
    : { href: "/applicant", label: "My applications" };

  if (mobile) {
    return (
      <div className="space-y-2">
        <p className="px-2 text-xs text-navy-100">Signed in as {auth.name}</p>
        <Link
          href={destination.href}
          className="block rounded border border-navy-400 px-3 py-2 text-center text-sm"
        >
          {destination.label}
        </Link>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="w-full rounded px-3 py-2 text-center text-sm text-navy-100 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <span className="max-w-[140px] truncate text-xs text-navy-100" title={auth.name}>
        {auth.name}
      </span>
      <Link
        href={destination.href}
        className="whitespace-nowrap rounded border border-navy-400 px-3 py-1.5 hover:border-white"
      >
        {destination.label}
      </Link>
      <form action="/auth/logout" method="post" className="inline">
        <button
          type="submit"
          className="text-xs text-navy-100 underline-offset-4 hover:text-white hover:underline"
        >
          Sign out
        </button>
      </form>
    </span>
  );
}

export interface NavItem {
  href: string;
  label: string;
}

export function HeaderNav({
  items,
  departments,
}: {
  items: NavItem[];
  departments: NavItem[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const auth = useAuthState();
  const deptRef = useRef<HTMLLIElement>(null);

  // Close the desktop dropdown on outside click / escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setDeptOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDeptOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      {/* Desktop nav */}
      <nav aria-label="Primary" className="hidden md:block">
        <ul className="flex items-center gap-5 whitespace-nowrap text-sm font-medium">
          <li ref={deptRef} className="relative">
            <button
              type="button"
              onClick={() => setDeptOpen((v) => !v)}
              aria-expanded={deptOpen}
              className="flex items-center gap-1 hover:text-gold-200"
            >
              Departments
              <svg
                className={`h-3 w-3 transition-transform ${deptOpen ? "rotate-180" : ""}`}
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {deptOpen && (
              <ul className="absolute right-0 top-full z-20 mt-2 w-72 rounded border border-navy-700 bg-navy-900 py-1 shadow-lg">
                {departments.map((dept) => (
                  <li key={dept.href}>
                    <Link
                      href={dept.href}
                      onClick={() => setDeptOpen(false)}
                      className="block px-4 py-2.5 text-sm hover:bg-navy-800 hover:text-gold-200"
                    >
                      {dept.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
          {items.map((item) => (
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
            <AuthLinks auth={auth} />
          </li>
        </ul>
      </nav>

      {/* Mobile burger */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="rounded border border-navy-400 p-2 md:hidden"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {mobileOpen ? (
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" />
          )}
        </svg>
      </button>

      {/* Mobile panel */}
      {mobileOpen && (
        <nav
          aria-label="Primary"
          className="absolute inset-x-0 top-full z-20 border-b-4 border-gold-500 bg-navy-900 md:hidden"
        >
          <ul className="px-4 py-3">
            <li className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-100">
              Departments
            </li>
            {departments.map((dept) => (
              <li key={dept.href}>
                <Link
                  href={dept.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded px-2 py-2.5 text-sm hover:bg-navy-800"
                >
                  {dept.label}
                </Link>
              </li>
            ))}
            <li className="my-2 border-t border-navy-700" />
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded px-2 py-2.5 text-sm hover:bg-navy-800"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2">
              <AuthLinks auth={auth} mobile />
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}
