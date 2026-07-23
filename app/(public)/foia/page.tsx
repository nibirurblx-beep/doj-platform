import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import {
  FOI_COVERED,
  FOI_EXEMPT_BODIES,
  FOI_EXEMPTIONS,
  FOI_STATUS_LABELS,
} from "@/lib/foi/constants";
import { FoiForm, AppealForm } from "./foi-form";

export const metadata: Metadata = { title: "Freedom of Information" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function FoiaPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const service = createSupabaseServiceClient();
  const { data: organisations } = await service
    .from("organisations")
    .select("id, name")
    .order("name");

  const { data: myRequests } = user
    ? await service
        .from("foi_requests")
        .select(
          "id, reference, status, description, submitted_at, receipt_due, decision_due, extended_due, receipt_note, late_reason, decision_note, denial_exemptions, appeal_note, organisations(name)",
        )
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
    : { data: null };

  return (
    <div className="mx-auto max-w-measure px-6 py-16">
      <h1 className="font-display text-3xl">Freedom of Information Requests</h1>
      <p className="mt-4 leading-relaxed">
        Any individual, regardless of nationality, citizenship or criminal
        record, may request information from the departments and agencies
        covered by the community&rsquo;s Freedom of Information Act. Requests
        made here satisfy the act&rsquo;s formatting requirements
        automatically: your name, the recipient agency, the submission date
        and the statutory statement are recorded with your request.
      </p>

      {/* Timeline */}
      <section className="mt-8 rounded border border-grey-200 bg-white p-6">
        <h2 className="font-display text-xl">What to expect</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-grey-800">
          <li>
            A <strong>receipt</strong> within 3 days confirming your request
            was properly submitted, or explaining how to correct it.
          </li>
          <li>
            A <strong>decision</strong> within 14 days: the information (or
            where to find it), a denial citing a statutory exemption, or a
            late notice extending processing to at most 30 days from
            submission, with reasons.
          </li>
          <li>
            If denied, you may <strong>appeal to the agency</strong> from this
            page. If the appeal is denied, the act provides for a civil suit
            in the United States District Court.
          </li>
        </ol>
      </section>

      {/* Submit */}
      <section className="mt-8 rounded border border-grey-200 bg-white p-6">
        <h2 className="font-display text-xl">Submit a request</h2>
        {user ? (
          <div className="mt-4">
            <FoiForm
              organisations={(organisations ?? []).map((o) => ({
                id: o.id,
                name: o.name,
              }))}
            />
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-grey-700">
              Sign in or create a free account to submit a request — this is
              how receipts and decisions are delivered to you.
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href="/auth/register?next=/foia"
                className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800"
              >
                Create an account
              </Link>
              <Link
                href="/auth/login?next=/foia"
                className="rounded border border-grey-300 px-4 py-2 text-sm hover:border-navy-900"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* My requests */}
      {user && (myRequests ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl">Your requests</h2>
          <div className="mt-4 space-y-4">
            {(myRequests ?? []).map((req) => (
              <div
                key={req.id}
                className="rounded border border-grey-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm">{req.reference}</p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      req.status === "completed" || req.status === "appeal_completed"
                        ? "bg-green-50 text-green-700"
                        : req.status === "denied" || req.status === "appeal_denied"
                          ? "bg-red-50 text-red-800"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {FOI_STATUS_LABELS[req.status] ?? req.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-grey-500">
                  To{" "}
                  {(req.organisations as unknown as { name: string } | null)?.name}{" "}
                  · submitted {formatDate(req.submitted_at)} · decision due{" "}
                  {formatDate(req.extended_due ?? req.decision_due)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-grey-800">
                  {req.description}
                </p>

                {req.receipt_note && (
                  <div className="mt-3 rounded bg-grey-050 p-3 text-sm">
                    <p className="text-xs font-medium uppercase text-grey-500">
                      Receipt
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{req.receipt_note}</p>
                  </div>
                )}
                {req.late_reason && (
                  <div className="mt-2 rounded bg-amber-50 p-3 text-sm">
                    <p className="text-xs font-medium uppercase text-amber-700">
                      Late notice
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{req.late_reason}</p>
                  </div>
                )}
                {req.decision_note && (
                  <div className="mt-2 rounded bg-grey-050 p-3 text-sm">
                    <p className="text-xs font-medium uppercase text-grey-500">
                      Decision
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{req.decision_note}</p>
                    {(req.denial_exemptions ?? []).length > 0 && (
                      <p className="mt-2 text-xs text-grey-600">
                        Exemption(s) cited:{" "}
                        {(req.denial_exemptions ?? [])
                          .map(
                            (key: string) =>
                              `(${key}) ${FOI_EXEMPTIONS.find((e) => e.key === key)?.label ?? ""}`,
                          )
                          .join("; ")}
                      </p>
                    )}
                  </div>
                )}
                {req.appeal_note && (
                  <div className="mt-2 rounded bg-grey-050 p-3 text-sm">
                    <p className="text-xs font-medium uppercase text-grey-500">
                      Appeal outcome
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{req.appeal_note}</p>
                  </div>
                )}
                {req.status === "denied" && <AppealForm requestId={req.id} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Coverage */}
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded border border-grey-200 bg-white p-6">
          <h2 className="font-display text-lg">Handled through this site</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-grey-800">
            {FOI_COVERED.map((body) => (
              <li key={body}>{body}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-grey-500">
            Subsidiary agency requests are consolidated into the Department
            of Justice&rsquo;s processing under section 5(c)(1). Requests for
            other government departments covered by the act must be sent to
            those departments directly.
          </p>
        </div>
        <div className="rounded border border-grey-200 bg-white p-6">
          <h2 className="font-display text-lg">Not subject to requests</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-grey-800">
            {FOI_EXEMPT_BODIES.map((body) => (
              <li key={body}>{body}</li>
            ))}
          </ul>
          <h3 className="mt-5 font-display text-sm">
            Information exemptions
          </h3>
          <p className="mt-1 text-xs text-grey-600">
            Requests may be redacted or denied only where the information
            falls under a statutory exemption, and reasonable redaction must
            be attempted before an outright denial:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-grey-700">
            {FOI_EXEMPTIONS.map((ex) => (
              <li key={ex.key}>
                ({ex.key}) {ex.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
