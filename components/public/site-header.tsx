import Link from "next/link";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/news", label: "News" },
  { href: "/resources", label: "Resources" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b-4 border-gold-500 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-4">
          {/* Seal area: official seal asset lands with branding answers (Q2) */}
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold-500 font-display text-lg"
          >
            DOJ
          </span>
          <span>
            <span className="block font-display text-xl leading-tight">
              Department of Justice
            </span>
            <span className="block text-xs uppercase tracking-[0.18em] text-navy-100">
              Roleplay Community
            </span>
          </span>
        </Link>
        <nav aria-label="Primary">
          <ul className="flex flex-wrap gap-6 text-sm font-medium">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="hover:text-gold-200 hover:underline hover:underline-offset-4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
