import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-grey-050">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="block">
            <p className="font-display text-2xl">Department of Justice</p>
          </Link>

          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="hidden bg-navy-900 text-white lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-8">
        <blockquote className="text-lg">
          <p className="font-serif">
            "The Department of Justice exists to enforce the law and defend
            the interests of the United States according to the law."
          </p>
        </blockquote>
      </div>
    </div>
  );
}
