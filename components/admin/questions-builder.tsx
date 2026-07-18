"use client";

import type { VacancyQuestion } from "@/app/portal/admin/vacancies/actions";

const TYPE_LABELS: Record<VacancyQuestion["type"], string> = {
  short_text: "Short answer",
  long_text: "Long answer",
  yes_no: "Yes / No",
  select: "Multiple choice",
};

export function QuestionsBuilder({
  questions,
  onChange,
}: {
  questions: VacancyQuestion[];
  onChange: (questions: VacancyQuestion[]) => void;
}) {
  function update(index: number, patch: Partial<VacancyQuestion>) {
    const next = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    onChange(next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    const currentItem = next[index];
    const targetItem = next[target];
    if (!currentItem || !targetItem) return;
    next[index] = targetItem;
    next[target] = currentItem;
    onChange(next);
  }

  function remove(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function add() {
    onChange([
      ...questions,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "short_text",
        required: true,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-sm text-grey-500">
          No questions yet. Applicants will only confirm their details.
        </p>
      )}

      {questions.map((q, index) => (
        <div key={q.id} className="rounded border border-grey-200 bg-grey-050 p-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[240px] flex-1">
              <input
                type="text"
                value={q.label}
                onChange={(e) => update(index, { label: e.target.value })}
                placeholder={`Question ${index + 1}`}
                className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
              />
            </div>
            <select
              value={q.type}
              onChange={(e) =>
                update(index, {
                  type: e.target.value as VacancyQuestion["type"],
                  options:
                    e.target.value === "select"
                      ? q.options ?? ["Option 1", "Option 2"]
                      : undefined,
                })
              }
              className="rounded border border-grey-300 px-2 py-2 text-sm"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 py-2 text-sm text-grey-700">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => update(index, { required: e.target.checked })}
              />
              Required
            </label>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded border border-grey-300 px-2 py-1 text-xs disabled:opacity-40" title="Move up">↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === questions.length - 1} className="rounded border border-grey-300 px-2 py-1 text-xs disabled:opacity-40" title="Move down">↓</button>
              <button type="button" onClick={() => remove(index)} className="rounded border border-grey-300 px-2 py-1 text-xs text-red-800" title="Remove">✕</button>
            </div>
          </div>

          {q.type === "select" && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-grey-600">
                Options (one per line)
              </label>
              <textarea
                value={(q.options ?? []).join("\n")}
                onChange={(e) =>
                  update(index, {
                    options: e.target.value
                      .split("\n")
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })
                }
                rows={3}
                className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900"
      >
        + Add question
      </button>
    </div>
  );
}
