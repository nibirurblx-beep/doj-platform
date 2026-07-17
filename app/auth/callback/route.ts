import { createSupabaseServerClient } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Supabase Auth OAuth callback handler.
 * Phase 1B: placeholder for email/password only.
 * Phase 1I: wired for Discord login.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Phase 1B: email/password flow does not use this endpoint.
  // Phase 1I: uncomment the exchange below.
  /*
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  */

  return NextResponse.redirect(new URL("/portal", request.url));
}
