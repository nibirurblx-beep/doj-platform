import { createSupabaseServiceClient } from "@/lib/db/server";
import { NextResponse } from "next/server";

/**
 * Health check hit daily by Vercel cron (vercel.json). The database read
 * counts as activity, which stops the Supabase free-tier project from
 * pausing after 7 idle days.
 */
export async function GET() {
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service
      .from("organisations")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
