import type { Metadata } from "next";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <article className="mx-auto max-w-measure px-6 py-16">
      <h1 className="font-display text-3xl">Disclaimer</h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed">
        <p>
          This website belongs to a fictional roleplay community operating on
          the Roblox platform. Everything published here, including
          departments, offices, titles, personnel, news, legal resources and
          careers, exists solely for entertainment within that community.
        </p>
        <p>This platform is not affiliated with, endorsed by or connected to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>the real United States Government;</li>
          <li>the real United States Department of Justice;</li>
          <li>Roblox Corporation;</li>
          <li>Discord Inc.</li>
        </ul>
        <p>
          Nothing on this website constitutes real legal advice, real legal
          authority or real government communication. Do not rely on any
          content here for real-world purposes.
        </p>
      </div>
    </article>
  );
}
