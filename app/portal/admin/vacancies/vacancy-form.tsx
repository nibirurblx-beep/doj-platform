"use client";

import { useActionState, useState } from "react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { QuestionsBuilder } from "@/components/admin/questions-builder";
import {
  createVacancyAction,
  updateVacancyAction,
  changeVacancyStatusAction,
  type VacancyQuestion,
} from "@/app/portal/admin/vacancies/actions";

export interface VacancyInput {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  organisationId: string;
  descriptionHtml: string;
  questions: VacancyQuestion[];
  status: string;
}

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function VacancyForm({
  vacancy,
  organisations,
  canPublish,
}: {
  vacancy: VacancyInput;
  organisations: Array<{ id: string; name: string }>;
  canPublish: boolean;
}) {
  const isNew = !vacancy.id;
  const [descriptionHtml, setDescriptionHtml] = useState(vacancy.descriptionHtml);
  const [questions, setQuestions] = useState<VacancyQuestion[]>(vacancy.questions);

  const [saveState, saveAction, isSaving] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      formData.set("descriptionHtml", descriptionHtml);
      formData.set("questionsJson", JSON.stringify(questions));
      return isNew ? createVacancyAction(formData) : updateVacancyAction(formData);
    },
    null,
  );

  const [statusState, statusAction, isChangingStatus] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      return changeVacancyStatusAction(formData);
    },
    null,
  );

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-4">
        {!isNew && <input type="hidden" name="id" value={vacancy.id} />}

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
              defaultValue={vacancy.title}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
              placeholder="e.g. Special Agent"
            />
          </div>

          <div>
            <label htmlFor="organisationId" className="block text-sm font-medium">
              Organisation
            </label>
            <select
              id="organisationId"
              name="organisationId"
              required
              defaultValue={vacancy.organisationId}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            >
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium">
              Slug <span className="text-grey-500">(blank = from title)</span>
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={vacancy.slug}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="summary" className="block text-sm font-medium">
              Summary <span className="text-grey-500">(one line, shown in listings)</span>
            </label>
            <input
              id="summary"
              name="summary"
              type="text"
              defaultValue={vacancy.summary}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Description</span>
          <RichTextEditor
            initialHtml={vacancy.descriptionHtml}
            onChange={setDescriptionHtml}
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">
            Application questions
          </span>
          <QuestionsBuilder questions={questions} onChange={setQuestions} />
        </div>

        {saveState?.error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {saveState.error}
          </p>
        )}
        {saveState?.success && (
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
            {isSaving ? "Saving…" : isNew ? "Create draft vacancy" : "Save changes"}
          </button>
          <span className="text-sm text-grey-600">
            Status: <strong className="capitalize">{vacancy.status}</strong>
          </span>
          {vacancy.status === "open" && (
            <a
              href={`/careers/${vacancy.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-navy-900 underline"
            >
              View live
            </a>
          )}
        </div>
      </form>

      {!isNew && canPublish && (
        <div className="rounded border border-grey-200 bg-grey-050 p-4">
          <h3 className="text-sm font-medium">Applications</h3>
          {statusState?.error && (
            <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {statusState.error}
            </p>
          )}
          <form action={statusAction} className="mt-3 flex gap-2">
            <input type="hidden" name="id" value={vacancy.id} />
            {vacancy.status !== "open" && (
              <button
                type="submit"
                name="action"
                value="open"
                disabled={isChangingStatus}
                className="rounded bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800 disabled:opacity-50"
              >
                Open for applications
              </button>
            )}
            {vacancy.status === "open" && (
              <button
                type="submit"
                name="action"
                value="close"
                disabled={isChangingStatus}
                className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-red-800 hover:text-red-800 disabled:opacity-50"
              >
                Close applications
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
