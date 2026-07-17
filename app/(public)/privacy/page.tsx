import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-measure px-6 py-16">
      <h1 className="font-display text-3xl">Privacy notice</h1>
      <p className="mt-6 leading-relaxed">
        The full privacy notice will be published before applications open. It
        will explain what account information the platform stores, why it is
        needed for roleplay operations, how long it is kept and how to request
        deletion. This platform deliberately does not collect real-world
        sensitive information such as home addresses, dates of birth or
        government identification.
      </p>
    </article>
  );
}
