"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export interface PortalTask {
  href: string;
  label: string;
  detail?: string;
  urgent?: boolean;
}

/** Task bell: everything currently awaiting the signed-in user, computed
 *  server-side and passed in. */
export function NotificationsBell({ tasks }: { tasks: PortalTask[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const urgentCount = tasks.filter((t) => t.urgent).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications: ${tasks.length} item${tasks.length === 1 ? "" : "s"}`}
        className="relative rounded border border-grey-300 p-2 hover:border-navy-900"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2a5 5 0 0 0-5 5v3l-1.5 3h13L15 10V7a5 5 0 0 0-5-5zM8 15a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {tasks.length > 0 && (
          <span
            className={`absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              urgentCount > 0 ? "bg-red-700" : "bg-navy-900"
            }`}
            style={{ height: "18px", minWidth: "18px" }}
          >
            {tasks.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded border border-grey-200 bg-white shadow-lg">
          <div className="border-b border-grey-200 px-4 py-2.5">
            <p className="text-sm font-medium">Awaiting you</p>
          </div>
          {tasks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-grey-600">
              Nothing needs your attention. 🎉
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {tasks.map((task, i) => (
                <li key={i} className="border-b border-grey-100 last:border-0">
                  <Link
                    href={task.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 hover:bg-grey-050"
                  >
                    <span className="flex items-start gap-2">
                      {task.urgent && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-600" />
                      )}
                      <span>
                        <span className="block text-sm text-navy-900">
                          {task.label}
                        </span>
                        {task.detail && (
                          <span className="block text-xs text-grey-500">
                            {task.detail}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
