"use client";

import { useActionState, useState } from "react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  createContentAction,
  updateContentAction,
  changeContentStatusAction,
} from "@/app/portal/content/actions";

export interface ContentPostInput {
  id?: string;
  type: "news" | "page";
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  status: string;
  coverImageUrl?: string | null;
}

export function ContentForm({
  post,
  canPublish,
}: {
  post: ContentPostInput;
  canPublish: boolean;
}) {
  const isNew = !post.id;
  const [bodyHtml, setBodyHtml] = useState(post.bodyHtml);

  const [saveState, saveAction, isSaving] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      formData.set("bodyHtml", bodyHtml);
      return isNew ? createContentAction(formData) : updateContentAction(formData);
    },
    null,
  );

  const [statusState, statusAction, isChangingStatus] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      return changeContentStatusAction(formData);
    },
    null,
  );

  const publicPath =
    post.type === "news" ? `/news/${post.slug}` : `/p/${post.slug}`;

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-4">
        {!isNew && <input type="hidden" name="id" value={post.id} />}
        <input type="hidden" name="type" value={post.type} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={post.title}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium">
              Slug <span className="text-grey-500">(blank = from title)</span>
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={post.slug}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm font-mono"
              placeholder="my-article"
            />
          </div>

          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium">
              Excerpt <span className="text-grey-500">(shown in listings)</span>
            </label>
            <input
              id="excerpt"
              name="excerpt"
              type="text"
              defaultValue={post.excerpt}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">
            Cover image <span className="font-normal text-grey-500">(shown on cards and listings, max 5 MB)</span>
          </span>
          {post.coverImageUrl && (
            <div className="mb-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverImageUrl}
                alt="Current cover"
                className="h-16 w-28 rounded border border-grey-200 object-cover"
              />
              <label className="flex items-center gap-1.5 text-sm text-grey-700">
                <input type="checkbox" name="removeCover" />
                Remove current cover
              </label>
            </div>
          )}
          <input
            type="file"
            name="coverImage"
            accept="image/*"
            className="text-sm file:mr-2 file:rounded file:border file:border-grey-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Content</span>
          <RichTextEditor initialHtml={post.bodyHtml} onChange={setBodyHtml} />
        </div>

        {saveState && "error" in saveState && saveState.error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {saveState.error}
          </p>
        )}
        {saveState && "success" in saveState && saveState.success && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
            {saveState.message}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : isNew ? "Create draft" : "Save changes"}
          </button>
          <span className="text-sm text-grey-600">
            Status: <strong className="capitalize">{post.status}</strong>
          </span>
          {post.status === "published" && (
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-navy-900 underline"
            >
              View live
            </a>
          )}
        </div>
      </form>

      {!isNew && (
        <div className="rounded border border-grey-200 bg-grey-050 p-4">
          <h3 className="text-sm font-medium">Workflow</h3>
          {statusState && "error" in statusState && statusState.error && (
            <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {statusState.error}
            </p>
          )}
          <form action={statusAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={post.id} />
            {post.status === "draft" && (
              <button
                type="submit"
                name="action"
                value="submit_review"
                disabled={isChangingStatus}
                className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900 disabled:opacity-50"
              >
                Submit for review
              </button>
            )}
            {canPublish && post.status !== "published" && post.status !== "archived" && (
              <button
                type="submit"
                name="action"
                value="publish"
                disabled={isChangingStatus}
                className="rounded bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800 disabled:opacity-50"
              >
                Publish now
              </button>
            )}
            {canPublish && post.status === "published" && (
              <button
                type="submit"
                name="action"
                value="unpublish"
                disabled={isChangingStatus}
                className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-red-800 hover:text-red-800 disabled:opacity-50"
              >
                Unpublish (back to draft)
              </button>
            )}
            {canPublish && post.status !== "archived" && (
              <button
                type="submit"
                name="action"
                value="archive"
                disabled={isChangingStatus}
                className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm text-grey-600 hover:border-grey-500 disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
