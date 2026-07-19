import Link from "next/link";

export const metadata = { title: "Guide" };

/**
 * Static portal handbook. Edit the SECTIONS array to change content —
 * no database involved, so it ships with the code and stays in sync
 * with features.
 */
const SECTIONS: Array<{
  id: string;
  title: string;
  intro?: string;
  steps: string[];
  tips?: string[];
}> = [
  {
    id: "portal",
    title: "Finding your way around",
    intro:
      "The left sidebar shows only the sections your roles allow. Most staff see Dashboard, Documents, Guide and Settings.",
    steps: [
      "Dashboard: your starting point. Leadership and global admins also see the Overview numbers (applications awaiting review, open vacancies, active employees, pending invitations) and quick access buttons.",
      "Content: for content authors — news posts and website pages.",
      "Employment register: for leadership — applications, vacancies and employees in one place.",
      "Documents: the staff file repository.",
      "Administration: for leadership and global admins — users, invitations and organisation structure.",
      "Return to main site (bottom of the sidebar) takes you back to the public website.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts: staff vs applicants",
    steps: [
      "Staff accounts are invitation-only and belong to at least one organisation. Staff land in the portal when they sign in.",
      "Applicants register themselves from the careers pages. They land on the public site, use their own dashboard at /applicant, and cannot enter the portal.",
      "The public site header shows who is signed in, with a button to their portal or applicant dashboard and a sign out link.",
    ],
  },
  {
    id: "invitations",
    title: "Inviting staff",
    intro:
      "Administration → Invitations. Staff accounts are invitation-only.",
    steps: [
      "Enter their email, organisation, role and (optionally) a division/team.",
      "They receive an email with a one-time activation link (valid 7 days) and set their own password — there are no temporary passwords.",
      "Pending invitations can be revoked at any time; revoked links stop working immediately.",
    ],
    tips: [
      "If the email fails to send, the invitation is automatically revoked so you can safely retry.",
      "Leadership can invite within their own department; global admins anywhere.",
    ],
  },
  {
    id: "users",
    title: "Managing users",
    intro: "Administration → Users (requires user management permission).",
    steps: [
      "Edit: change a display name, Roblox username or email inline.",
      "Grant a role: pick the organisation, then the role — the membership is created automatically. This is how you make someone department Leadership.",
      "Revoke a role with the ✕ on its chip.",
      "Set someone's division/team with the dropdown on each membership row.",
      "Suspend locks the account out everywhere immediately, with a reason recorded. Unsuspend lifts it.",
      "Delete permanently removes the account and everything attached. Type DELETE to confirm.",
    ],
    tips: [
      "Prefer Suspend over Delete for people leaving — it keeps records and the audit trail intact.",
      "Global roles (Platform Administrator) can only be granted or revoked by the platform owner, and the owner account cannot be suspended or deleted.",
    ],
  },
  {
    id: "organisation",
    title: "Organisations and divisions/teams",
    intro: "Administration → Organisation.",
    steps: [
      "Each organisation card lists its divisions with rename and delete controls.",
      "Create an organisation with a name and permanent slug — the standard Staff, Leadership and Content Author roles are cloned automatically so it is usable immediately.",
      "Create divisions/teams at the bottom of the page (e.g. United States Attorney's Office). They then appear in the invite, convert, add employee and user management forms.",
      "Delete an organisation only when it is empty; the page tells you exactly what is blocking.",
      "Deleting a division is safe: people assigned to it simply end up with no division.",
    ],
  },
  {
    id: "content",
    title: "News and pages (CMS)",
    intro: "Content in the sidebar, for anyone with content permissions.",
    steps: [
      "New post: choose News (homepage and /news) or Page (appears at /p/slug).",
      "Write with the rich text editor; add an optional cover image (max 5 MB) — it becomes the card image on the homepage and listings.",
      "Posts start as drafts. Publish when ready; unpublish or archive any time.",
      "Published Pages appear automatically in the public site header — publish pages titled About and Contact and the nav grows them itself.",
    ],
  },
  {
    id: "employment",
    title: "Employment register",
    intro:
      "Applications, Vacancies and Employees live together under Employment register (leadership and global admins).",
    steps: [
      "Vacancies: create with title, summary, description and organisation; build the application form with the question builder; open to take applications on /careers, close to stop.",
      "Applications: filter by status and vacancy; open one to see answers beside the questions; move it Submitted → Under review → Accepted or Rejected (rejected can be reopened). Internal notes are never visible to applicants.",
      "Employees: two ways in — convert an accepted application, or Add employee for people brought in outside the careers process. Both assign organisation, role, division and rank, and issue the employee number automatically.",
      "Click any employee number for their profile: details, pre-employment checklist (each tick records who and when) and private files such as the signed NDA and contract.",
      "Department leadership only sees their own organisation's applications, vacancies and employees; global admins see everything.",
    ],
  },
  {
    id: "documents",
    title: "Documents",
    steps: [
      "Browse, upload (20 MB max), create folders, download. Staff can view and download; leadership and global admins can upload, organise and delete.",
      "Every folder has a visibility dropdown: All staff, or Private to a department. Privacy covers everything inside the folder and can be changed at any time.",
      "Private folders show a navy 'Private to …' badge. No badge means all staff can see it.",
      "Department leadership can restrict folders to their own department; global admins to any.",
      "Employee files (NDAs, contracts) never appear in this browser — they live on employee profiles with their own protection.",
    ],
  },
  {
    id: "settings",
    title: "Settings",
    steps: [
      "Change your display name any time.",
      "Change your email — your current password is required, since it moves the account.",
      "Connect or disconnect Discord. Once connected you can use Sign in with Discord on the login page.",
    ],
  },
  {
    id: "safety",
    title: "Audit and safety",
    steps: [
      "Every significant action — logins, role changes, publishes, status changes, uploads, downloads, deletions — is recorded in the audit log with who did it and when.",
      "Suspended users are locked out of everything the moment the suspension is saved, even mid-session.",
      "Every page and action re-checks permissions on the server; hiding a button is never the only protection.",
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">How to use the portal</h1>
        <p className="mt-1 text-sm text-grey-600">
          A working handbook. Sections describe features your roles may not
          include — that is what to ask an administrator for. Jump to a
          section:
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-block rounded bg-grey-100 px-2.5 py-1 text-xs text-navy-900 hover:bg-grey-200"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-4 rounded border border-grey-200 bg-white p-6"
        >
          <h2 className="font-display text-lg">{section.title}</h2>
          {section.intro && (
            <p className="mt-2 text-sm text-grey-700">{section.intro}</p>
          )}
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-grey-800">
            {section.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {section.tips && (
            <div className="mt-4 rounded bg-grey-050 p-3">
              {section.tips.map((tip, i) => (
                <p key={i} className="text-xs text-grey-600">
                  💡 {tip}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      <p className="text-xs text-grey-500">
        Something missing or unclear? This page lives in the codebase at{" "}
        <code className="rounded bg-grey-100 px-1">app/portal/guide/page.tsx</code>{" "}
        — edit the SECTIONS list. For applicant-facing help, publish a CMS page
        instead (
        <Link href="/portal/content" className="underline">
          Content
        </Link>
        ).
      </p>
    </div>
  );
}
