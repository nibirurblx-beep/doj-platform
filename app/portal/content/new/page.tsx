import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import { ContentForm } from "../content-form";

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  if (!(await hasPermissionAnywhere(PERMISSIONS.CONTENT_CREATE))) {
    redirect("/portal/admin");
  }
  const canPublish = await hasPermissionAnywhere(PERMISSIONS.CONTENT_PUBLISH);

  const params = await searchParams;
  const validTypes = ["news", "page", "press_release", "case_summary"] as const;
  const type = (validTypes as readonly string[]).includes(params.type ?? "")
    ? (params.type as (typeof validTypes)[number])
    : "news";

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg">
        New{" "}
        {type === "news"
          ? "news post"
          : type === "press_release"
            ? "press release"
            : type === "case_summary"
              ? "case summary"
              : "page"}
      </h3>
      <ContentForm
        post={{
          type,
          title: "",
          slug: "",
          excerpt: "",
          bodyHtml: "<p></p>",
          status: "draft",
        }}
        canPublish={canPublish}
      />
    </div>
  );
}
