import { getCurrentUser } from "@/lib/auth/session";

export default async function ApplicantPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Applicant portal</h1>
        <p className="mt-2 text-grey-600">
          The application tracking system arrives in Phase 1E.
        </p>
      </div>

      <div className="rounded border border-grey-200 bg-white p-6">
        <h2 className="font-medium">Your account</h2>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="text-grey-600">Name: </span>
            <span className="font-medium">{user?.displayName}</span>
          </p>
          <p>
            <span className="text-grey-600">Email: </span>
            <span className="font-medium">{user?.email}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
