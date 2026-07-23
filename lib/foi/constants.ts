/** Statutory exemptions - the only grounds on which a request may be
 *  denied in whole or part. Redaction must be attempted before denial. */
export const FOI_EXEMPTIONS: Array<{ key: string; label: string }> = [
  { key: "i", label: "Information made confidential by a legal order or legal agreement" },
  { key: "ii", label: "Information that may jeopardise the secrecy of an investigation or law enforcement operation" },
  { key: "iii", label: "Information that jeopardises national security and/or defence" },
  { key: "iv", label: "Information involved in a sealed court or other legal proceeding" },
  { key: "v", label: "Information that may disclose the identity of confidential sources and informants" },
  { key: "vi", label: "Information disclosing sensitive emergency protocols" },
  { key: "vii", label: "Information disclosing sensitive protection, patrol, investigation, law enforcement, prosecution and/or interrogation techniques" },
  { key: "viii", label: "Information that would deprive someone of their constitutional rights, including the right to a fair trial" },
];

export const FOI_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted - awaiting receipt",
  acknowledged: "Acknowledged - being processed",
  needs_correction: "Needs correction",
  late_notice: "Extended - late notice issued",
  completed: "Completed",
  denied: "Denied",
  appealed: "Appeal under review",
  appeal_completed: "Appeal granted - completed",
  appeal_denied: "Appeal denied",
};

export const FOI_OPEN_STATUSES = ["submitted", "acknowledged", "late_notice", "appealed"];

/** What this site accepts requests for: the Department of Justice and its
 *  subsidiaries, whose FOIR processing is consolidated into the DOJ under
 *  section 5(c)(1) of the act. */
export const FOI_COVERED = [
  "The Department of Justice",
  "The Metropolitan Police Department",
  "The Federal Bureau of Investigation",
];

export const FOI_EXEMPT_BODIES = [
  "The Federal Bureau of Investigation's National Security Branch",
];
