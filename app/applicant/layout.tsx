import { requireActiveUser } from "@/lib/auth/session";
import Link from "next/link";

export const metadata = { title: "Applicant portal" };

export default async function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireActiveUser();

  return (
    <div className="min-h-screen bg-grey-050">
      <header className="border-b border-grey-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <Link href="/" className="block">
            <p className="font-display text-lg">Department of Justice</p>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {children}
      </main>
    </div>
  );
}
