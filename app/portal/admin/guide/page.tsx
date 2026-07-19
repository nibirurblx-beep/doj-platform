import Link from "next/link";

export const metadata = { title: "How to use" };

/**
 * Static admin handbook. Edit the SECTIONS array to change content —
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
    id: "invitations",
    title: "Inviting staff",
    intro:
      "Staff accounts are invitation-only. Nobody can join as staff without one.",
    steps: [
      "Go to Invitations and enter their email, organisation, role and (optionally) a division.",
      "They receive an email with a one-time activation link (valid 7 days).",
      "They set their own password on activation — there are no temporary passwords.",
      "Pending invitations can be revoked at any time from the same page; revoked links stop working immediately.",
    ],
    tips: [
      "If the email fails to send, the invitation is automatically revoked so you can safely retry.",
      "Duplicate pending invitations to the same email are blocked.",
    ],
  },
  {
    id: "users",
    title: "Managing users and roles",
    intro:
      "The Users tab is the control panel for people (Platform Administrator only).",
    steps: [
      "Edit: change a display name, Roblox username or email inline.",
      "Grant a role: pick the organisation, then the role — the membership is created automatically. This is how you make someone MPD Leadership, for example.",
      "Revoke a role with the ✕ on its chip. You cannot revoke your own roles.",
      "Set a division per organisation with the dropdown on each membership row.",
      "Suspend locks the account out everywhere immediately and records a reason. Unsuspend lifts it.",
      "Delete permanently removes the account, its employee records, memberships and applications. Type DELETE to confirm.",
    ],
    tips: [
      "Prefer Suspend over Delete for people leaving the community — it keeps records and the audit trail intact.",
      "Leadership roles only see their own department's applications, employees and vacancies. Platform Administrator sees everything.",
      "Only the platform owner (OWNER_EMAIL) can grant or revoke global roles like Platform Administrator, and the owner account cannot be suspended or deleted.",
    ],
  },
  {
    id: "organisation",
    title: "Organisations and divisions",
    steps: [
      "The Organisation tab lists every department with its divisions nested underneath.",
      "Create an organisation with a name and a permanent slug. Standard Staff, Leadership and Content Author roles are cloned automatically so it is usable immediately.",
      "Rename organisations and divisions freely — the slug never changes.",
      "Delete an organisation only when it is empty (no members, employees, vacancies or invitations); the page tells you what is blocking.",
      "Deleting a division is safe: people assigned to it simply end up with no division.",
    ],
    tips: [
      "The slug drives employee numbers (e.g. DOJ-000001) and the department's private documents folder.",
      "A new organisation does not automatically get a public department page — ask your developer to add one.",
    ],
  },
  {
    id: "content",
    title: "News and pages (CMS)",
    steps: [
      "Content → New post. Choose News (appears on the homepage and /news) or Page (appears at /p/slug).",
      "Write with the rich text editor; add an optional cover image (max 5 MB) — it becomes the card image on the homepage and listings.",
      "Posts start as drafts. Publish when ready; unpublish or archive any time.",
      "Published Pages appear automatically in the public site header — publish pages titled About and Contact and the nav grows them itself.",
    ],
  },
  {
    id: "vacancies",
    title: "Vacancies and applications",
    steps: [
      "Vacancies → New vacancy: title, summary, description and the organisation it belongs to.",
      "Build the application form with the question builder: short text, long text, yes/no or multiple choice; mark questions required; reorder freely.",
      "Open the vacancy to take applications at /careers; close it to stop.",
      "Applications appear under the Applications tab with status filters. Open one to see answers side-by-side with the questions.",
      "Move it through Submitted → Under review → Accepted or Rejected. Rejected applications can be reopened.",
      "Internal notes on an application are never visible to the applicant.",
    ],
  },
  {
    id: "employees",
    title: "Employees",
    steps: [
      "Two ways in: convert an accepted application (button on the application page), or Add employee for people brought in outside the careers process.",
      "Both assign the organisation, an org-scoped role, optional division and rank, and issue the next employee number automatically.",
      "Click any employee number to open their profile: details, pre-employment checklist and files.",
      "Tick checklist items as they complete onboarding — each tick records who and when, with a progress bar.",
      "Upload their signed NDA, contract or anything else under Files. These are private: only staff with employee access for that organisation can see them.",
    ],
  },
  {
    id: "documents",
    title: "Documents",
    steps: [
      "The Documents section in the sidebar is the shared staff repository: browse, upload (20 MB max), create folders, download, delete.",
      "A top-level folder named exactly after a department slug (doj, mpd, fbi) is private to that department's members.",
      "Everything else is visible to all staff with document access.",
      "Employee files live in a protected area that never appears in this browser — they are reachable only through employee profiles.",
    ],
  },
  {
    id: "discord",
    title: "Discord",
    steps: [
      "Anyone can link their Discord in Settings → Connected accounts. One Discord account per platform account.",
      "Once linked, they can use Sign in with Discord on the login page.",
      "Discord sign-in never creates accounts: an unlinked Discord is rejected with an explanation.",
    ],
  },
  {
    id: "safety",
    title: "Audit and safety",
    steps: [
      "Every significant action — logins, role changes, publishes, status changes, uploads, downloads, deletions — is recorded in the audit log with who did it and when.",
      "Suspended users are locked out of everything the moment the suspension is saved, even mid-session.",
      "The admin area and every individual action re-check permissions on the server; hiding a button is never the only protection.",
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-xl">How to use the admin area</h2>
        <p className="mt-1 text-sm text-grey-600">
          A working handbook for staff with admin access. Jump to a section:
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
          <h3 className="font-display text-lg">{section.title}</h3>
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
        <code className="rounded bg-grey-100 px-1">
          app/portal/admin/guide/page.tsx
        </code>{" "}
        — edit the SECTIONS list. For applicant-facing help, publish a CMS
        page instead (<Link href="/portal/admin/content" className="underline">Content</Link>).
      </p>
    </div>
  );
}
