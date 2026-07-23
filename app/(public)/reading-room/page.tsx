import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { ReadingRoomShell, formatDate } from "./shared";

export const metadata: Metadata = { title: "Reading Room" };
export const revalidate = 300;

export default async function ReadingRoomPage() {
  const service = createSupabaseServiceClient();
  const { data: recent } = await service
    .from("content_posts")
    .select("id, title, slug, type, published_at")
    .eq("status", "published")
    .in("type", ["news", "press_release", "case_summary"])
    .order("published_at", { ascending: false })
    .limit(10);

  const hrefFor = (post: { type: string; slug: string }) =>
    post.type === "news"
      ? `/news/${post.slug}`
      : post.type === "press_release"
        ? `/reading-room/press-releases/${post.slug}`
        : `/reading-room/case-summaries/${post.slug}`;

  const typeLabel: Record<string, string> = {
    news: "News",
    press_release: "Press Release",
    case_summary: "Case Summary",
  };

  return (
    <ReadingRoomShell title="Electronic Reading Room" active="/reading-room">
      <p className="leading-relaxed text-grey-800">
        The Department of Justice Reading Room brings the department&rsquo;s
        public records together in one place: news, official press releases,
        summaries of closed cases, and the Freedom of Information programme
        through which any individual may request departmental records.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          {
            href: "/news",
            title: "News",
            text: "Announcements and updates from the department.",
          },
          {
            href: "/reading-room/press-releases",
            title: "Press Releases",
            text: "Official statements issued by the department.",
          },
          {
            href: "/reading-room/case-summaries",
            title: "Case Summaries",
            text: "Public summaries of concluded cases and proceedings.",
          },
          {
            href: "/foia",
            title: "Freedom of Information",
            text: "Request departmental records and track your requests.",
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded border border-grey-200 bg-white p-5 hover:border-navy-900 hover:shadow"
          >
            <h2 className="font-display text-lg text-navy-900">{card.title}</h2>
            <p className="mt-1 text-sm text-grey-700">{card.text}</p>
          </Link>
        ))}
      </div>

      {(recent ?? []).length > 0 && (
        <div className="mt-10">
          <h2 className="border-b border-grey-200 pb-2 font-display text-xl">
            Recently published
          </h2>
          <ul className="mt-3 space-y-2">
            {(recent ?? []).map((post) => (
              <li key={post.id} className="text-sm">
                <span className="mr-2 rounded bg-grey-100 px-1.5 py-0.5 text-xs text-grey-600">
                  {typeLabel[post.type]}
                </span>
                <Link
                  href={hrefFor(post)}
                  className="text-navy-900 hover:underline"
                >
                  {post.title}
                </Link>
                {post.published_at && (
                  <span className="ml-2 text-xs text-grey-500">
                    {formatDate(post.published_at)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ReadingRoomShell>
  );
}
