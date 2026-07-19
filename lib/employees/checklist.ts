/**
 * Pre-employment checklist items, in display order. Add or remove items
 * here; existing employees keep whatever they have ticked.
 */
export const CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: "application_reviewed", label: "Application reviewed" },
  { key: "interview_completed", label: "Interview completed" },
  { key: "background_check", label: "Background check passed" },
  { key: "nda_signed", label: "NDA signed and uploaded" },
  { key: "contract_signed", label: "Contract signed and uploaded" },
  { key: "discord_joined", label: "Joined the community Discord" },
  { key: "roblox_group", label: "Accepted into the Roblox group" },
  { key: "induction_training", label: "Induction training completed" },
];

export interface ChecklistState {
  [key: string]: { done: boolean; by?: string; at?: string };
}
