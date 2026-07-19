import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";
import { redirect } from "next/navigation";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  robloxUsername: string | null;
}

export interface UserSession {
  user: CurrentUser;
  isSuspended: boolean;
  organisations: Array<{ id: string; slug: string; name: string }>;
}

/**
 * Get the current signed-in user.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, roblox_username")
    .eq("id", authUser.id)
    .single();

  return {
    id: authUser.id,
    email: authUser.email || "",
    displayName: profile?.display_name || "",
    robloxUsername: profile?.roblox_username || null,
  };
}

/**
 * Get full session info including suspension status and organisations.
 */
export async function getUserSession(): Promise<UserSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const { data: securityStatus } = await supabase
    .from("user_security_status")
    .select("suspended_at")
    .eq("user_id", authUser.id)
    .single();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organisation_id")
    .eq("user_id", authUser.id)
    .eq("status", "active");

  const organisationIds = memberships?.map((m) => m.organisation_id) || [];

  const { data: organisations } = organisationIds.length
    ? await supabase
        .from("organisations")
        .select("id, slug, name")
        .in("id", organisationIds)
    : { data: [] };

  return {
    user,
    isSuspended: securityStatus?.suspended_at != null,
    organisations: organisations || [],
  };
}

/**
 * Require authentication. Redirects to /login if not signed in.
 */
export async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Require authentication AND active status (not suspended).
 * Redirects to /login if not signed in; shows error if suspended.
 */
export async function requireActiveUser() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  if (session.isSuspended) {
    redirect("/auth/suspended");
  }

  return session;
}

/**
 * Generate a cryptographically secure random token (32 bytes, hex-encoded).
 */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Staff = at least one organisation membership. Applicants have none.
 * Drives where login lands and who may enter the portal.
 */
export async function isStaffUser(userId: string): Promise<boolean> {
  const { createSupabaseServiceClient } = await import("@/lib/db/server");
  const service = createSupabaseServiceClient();
  const { count } = await service
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
