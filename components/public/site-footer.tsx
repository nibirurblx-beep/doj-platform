import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-grey-200 bg-grey-050">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-lg">Department of Justice</p>
            <p className="mt-2 text-sm text-grey-500">
              A fictional roleplay community platform.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">
              Information
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/disclaimer" className="hover:underline">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:underline">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">
              Get involved
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/careers" className="hover:underline">
                  Careers
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-grey-200 pt-6 text-xs text-grey-500">
          Not affiliated with the United States Government, the United States
          Department of Justice, Roblox Corporation or Discord.
        </p>
      </div>
    </footer>
  );
}
