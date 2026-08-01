"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Lets a manager start a signature request from a saved template. */
export function TemplatePicker({
  employeeId,
  templates,
}: {
  employeeId: string;
  templates: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [going, setGoing] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Start from a template:</span>
      <select
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        className="rounded border border-grey-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">Choose a template…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!templateId || going}
        onClick={() => {
          if (!templateId) return;
          setGoing(true);
          router.push(
            `/portal/employment/employees/${employeeId}/request-signature?template=${templateId}`,
          );
        }}
        className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {going ? "Opening…" : "Use template"}
      </button>
    </div>
  );
}
