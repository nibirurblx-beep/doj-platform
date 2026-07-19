import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { notFound, redirect } from "next/navigation";
import { ContentForm } from "../content-form";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasPermissionAnywhere(PERMISSIONS.CONTENT_EDIT))) {
    redirect("/portal/admin");
  }
  const canPublish = await hasPermissionAnywhere(PERMISSIONS.CONTENT_PUBLISH);

  const { id } = await params;
  const service = createSupabaseServiceClient();
  const { data: post } = await service
    .from("content_posts")
    .select("id, type, slug, title, excerpt, body_html, status, cover_image_url")
    .eq("id", id)
    .single();

  if (!post) notFound();

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg">
        Edit {post.type === "news" ? "news post" : "page"}
      </h3>
      <ContentForm
        post={{
          id: post.id,
          type: post.type as "news" | "page",
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          bodyHtml: post.body_html,
          status: post.status,
          coverImageUrl: post.cover_image_url,
        }}
        canPublish={canPublish}
      />
    </div>
  );
}
