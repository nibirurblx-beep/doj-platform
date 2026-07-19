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
  const type = params.type === "page" ? "page" : "news";

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg">
        New {type === "news" ? "news post" : "page"}
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
