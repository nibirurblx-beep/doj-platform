import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Account suspended</h1>
      <p className="text-sm text-grey-700">
        Your account has been suspended. Contact an administrator for more
        information.
      </p>
    </div>
  );
}
