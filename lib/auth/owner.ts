import "server-only";

/**
 * The platform owner: the single account allowed to grant or revoke
 * GLOBAL roles (e.g. Platform Administrator), and protected from
 * suspension or deletion by anyone else.
 *
 * Set OWNER_EMAIL in the environment to the owner's login email.
 * If unset, global role changes are blocked entirely (fail safe).
 */

export function ownerEmail(): string | null {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = ownerEmail();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}
