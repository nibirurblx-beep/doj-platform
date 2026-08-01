/**
 * Shared field model for placeable signature/fill fields. Used by the
 * placement UI, the signing UI, the template editor and the PDF engine.
 *
 * All coordinates are normalised 0-1 from the top-left of the page, so they
 * map onto true PDF points at any screen size.
 */

export type FieldKind = "signature" | "initials" | "text" | "date";
export type SignerRole = "employee" | "employer";
export type FillMode = "sender" | "signer";

export interface PlacedField {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FieldKind;
  /** For signature/initials, and for signer-filled text/date: who acts. */
  who: SignerRole;
  /** For text/date only: who provides the value. */
  fill?: FillMode;
  /** For text/date: shown as placeholder/label. */
  label?: string;
  /** For text/date: must be completed before submit. */
  required?: boolean;
  /** For sender-filled text/date: the value captured at request creation. */
  value?: string;
}

export const SIGNATURE_FONTS: Array<{ id: string; label: string; css: string }> = [
  { id: "dancing", label: "Flowing", css: "'Dancing Script', cursive" },
  { id: "caveat", label: "Handwritten", css: "'Caveat', cursive" },
  { id: "formal", label: "Formal script", css: "'Great Vibes', cursive" },
];

export const FIELD_MIN_W = 0.04;
export const FIELD_MIN_H = 0.015;

/** Back-compat: coerce a legacy signature-only box into a PlacedField. */
export function normaliseField(raw: Record<string, unknown>, index: number): PlacedField {
  const kind = (raw.kind as FieldKind) ?? "signature";
  return {
    id: (raw.id as string) ?? `f${index}`,
    page: Number(raw.page ?? 0),
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
    w: Number(raw.w ?? 0.2),
    h: Number(raw.h ?? 0.05),
    kind,
    who: (raw.who as SignerRole) ?? (raw.signer as SignerRole) ?? "employee",
    fill: raw.fill as FillMode | undefined,
    label: raw.label as string | undefined,
    required: Boolean(raw.required),
    value: raw.value as string | undefined,
  };
}

/** Fields a given stage must fill/sign: signer text/date + their signatures. */
export function fieldsForStage(
  fields: PlacedField[],
  stage: SignerRole,
): { signatures: PlacedField[]; inputs: PlacedField[] } {
  const signatures = fields.filter(
    (f) => (f.kind === "signature" || f.kind === "initials") && f.who === stage,
  );
  const inputs = fields.filter(
    (f) => (f.kind === "text" || f.kind === "date") && f.fill === "signer" && f.who === stage,
  );
  return { signatures, inputs };
}

/** Does the given stage have anything to do at all? */
export function stageHasWork(fields: PlacedField[], stage: SignerRole): boolean {
  const { signatures, inputs } = fieldsForStage(fields, stage);
  return signatures.length > 0 || inputs.length > 0;
}

/** Sender-filled text/date fields, to complete before sending. */
export function senderFields(fields: PlacedField[]): PlacedField[] {
  return fields.filter(
    (f) => (f.kind === "text" || f.kind === "date") && f.fill === "sender",
  );
}
