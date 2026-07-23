import Link from "next/link";

export const READING_ROOM_SECTIONS = [
  { href: "/reading-room", label: "Reading Room", exact: true },
  { href: "/news", label: "News" },
  { href: "/reading-room/press-releases", label: "Press Releases" },
  { href: "/reading-room/case-summaries", label: "Case Summaries" },
  { href: "/foia", label: "Freedom of Information" },
  { href: "/hall-of-attorney-generals", label: "Hall of Attorney Generals" },
];

/** DOJ-style left sidebar for the Reading Room section. */
export function ReadingRoomShell({
  title,
  active,
  children,
}: {
  title: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-10 md:grid-cols-[220px_1fr]">
        <aside>
          <h2 className="border-b-2 border-gold-500 pb-2 font-display text-lg text-navy-900">
            Reading Room
          </h2>
          <nav className="mt-2">
            <ul>
              {READING_ROOM_SECTIONS.map((item) => (
                <li key={item.href} className="border-b border-grey-200">
                  <Link
                    href={item.href}
                    className={`block px-1 py-2.5 text-sm hover:text-navy-900 hover:underline ${
                      item.href === active
                        ? "font-medium text-navy-900"
                        : "text-grey-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <div>
          <h1 className="font-display text-3xl">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
