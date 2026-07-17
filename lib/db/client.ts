"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client. Anon key only; everything is behind RLS. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
