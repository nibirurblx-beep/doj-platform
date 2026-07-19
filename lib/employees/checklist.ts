/**
 * Pre-employment checklist items, in display order. Add or remove items
 * here; existing employees keep whatever they have ticked (matched by key,
 * so renaming a label is safe, changing a key resets that item's ticks).
 */
export const CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: "application_reviewed", label: "Application Confirmed" },
  { key: "interview_completed", label: "Interview Completed" },
  { key: "background_check", label: "Background Check Passed" },
  { key: "nda_signed", label: "NDA Signed & Uploaded" },
  { key: "contract_signed", label: "Contract Signed & Uploaded" },
  { key: "discord_joined", label: "Joined Discord" },
  { key: "roblox_group", label: "Accepted Into The ROBLOX Group" },
  { key: "portal_access", label: "Provided Access To Portal" },
  { key: "shown_resources", label: "Shown Resources" },
];

export interface ChecklistState {
  [key: string]: { done: boolean; by?: string; at?: string };
}
