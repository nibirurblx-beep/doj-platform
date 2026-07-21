import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

const LAST_UPDATED = "19 July 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-grey-800">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-measure px-6 py-16">
      <h1 className="font-display text-3xl">Privacy notice</h1>
      <p className="mt-2 text-sm text-grey-600">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6 leading-relaxed">
        This platform runs a fictional Roblox roleplay community. It is not
        affiliated with any government. This notice explains what personal
        information the platform stores, why, and what you can do about it. We
        deliberately collect as little as possible: no home addresses, no
        dates of birth, no government identification, no payment details.
      </p>

      <Section title="What we collect">
        <p>
          <strong>Everyone with an account:</strong> your email address, a
          display name you choose, and a password (stored only in securely
          hashed form — we cannot see it).
        </p>
        <p>
          <strong>Optionally:</strong> your Roblox username, and your Discord
          ID and username if you choose to connect Discord. Connecting Discord
          is never required.
        </p>
        <p>
          <strong>Applicants:</strong> the answers you submit when applying
          for a community position.
        </p>
        <p>
          <strong>Community staff:</strong> role, department, division, rank,
          an onboarding checklist, and files related to your community
          position (such as community agreements) uploaded by staff
          administrators.
        </p>
        <p>
          <strong>Activity records:</strong> significant actions on the
          platform (signing in, submitting or reviewing applications,
          publishing content, uploading or downloading files) are logged with
          the acting account and a timestamp. This protects everyone by making
          administrative actions accountable.
        </p>
      </Section>

      <Section title="What we use it for">
        <p>
          Running the community: processing applications, managing staff
          records, publishing news, storing shared documents, and keeping the
          platform secure. Sign-in emails are used to send account messages
          such as invitations, activation links and password resets. We do not
          send marketing, we do not show advertising, and we do not sell or
          share your information with anyone for their own purposes.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          The platform sets only essential cookies: those that keep you signed
          in, and short-lived security tokens during Discord connection. There
          are no advertising or analytics cookies. We measure page views with
          Vercel Analytics, which is cookie-free and aggregated; it does
          not identify or track individual visitors.
        </p>
      </Section>

      <Section title="Who processes it">
        <p>
          The platform runs on trusted infrastructure providers acting on our
          instructions: <strong>Supabase</strong> (database, authentication
          and file storage), <strong>Vercel</strong> (website hosting) and{" "}
          <strong>Resend</strong> (account emails). If you connect or sign in
          with Discord, <strong>Discord</strong> processes that sign-in under
          its own privacy policy. Staff administrators of this community can
          see the information relevant to their role — for example, department
          leadership can see applications made to their department.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Account information is kept while your account exists. If your
          account is deleted, your profile, applications and memberships are
          deleted with it. Activity logs are retained for accountability of
          administrative actions.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          You can change your display name and email in Settings, and
          disconnect Discord at any time. You can ask us for a copy of the
          information we hold about you, ask us to correct it, or ask for your
          account and its information to be deleted. To do any of these,
          contact the community administrators through the community Discord
          server or the contact details published on this site, and we will
          respond within a reasonable time. If you are in the UK or EU, these
          rights are backed by data protection law, and you also have the
          right to complain to your data protection authority (in the UK, the
          ICO).
        </p>
      </Section>

      <Section title="Age">
        <p>
          This community is intended for people old enough to hold the
          accounts it connects to under the terms of Roblox and Discord. Do
          not include personal information beyond what is asked for in
          application answers.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this notice changes, the date at the top will be updated and
          significant changes will be announced in community news.
        </p>
      </Section>
    </article>
  );
}
