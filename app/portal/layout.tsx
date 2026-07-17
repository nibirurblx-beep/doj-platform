import { requireActiveUser } from "@/lib/auth/session";
import Link from "next/link";
import { PortalNav } from "@/components/portal/nav";
import { UserMenu } from "@/components/portal/user-menu";

export const metadata = { title: "Portal" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireActiveUser();

  return (
    <div className="flex min-h-screen bg-grey-050">
      {/* Sidebar navigation */}
      <aside className="hidden w-64 border-r border-grey-200 bg-white md:block">
        <div className="sticky top-0 space-y-6 p-6">
          <Link href="/portal" className="block">
            <p className="font-display text-lg">DOJ</p>
          </Link>
          <PortalNav />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="border-b border-grey-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="font-display text-xl">Portal</h1>
            <UserMenu user={session.user} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
