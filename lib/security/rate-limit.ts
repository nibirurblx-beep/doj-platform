import "server-only";
import { headers } from "next/headers";

/**
 * Sliding-window in-memory rate limiter for auth-sensitive actions.
 *
 * Honest limitation: state lives in process memory, so on serverless
 * hosting each instance keeps its own counters. That still blunts
 * casual brute force and costs nothing; swap for Upstash/Redis if the
 * community grows enough to care.
 */

const buckets = new Map<string, number[]>();

// Periodic sweep so the map cannot grow unbounded
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => now - t < windowMs);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Returns true when the caller is over the limit.
 * Keyed by action + IP (and optionally a target such as the email).
 */
export async function isRateLimited(
  action: string,
  options?: { limit?: number; windowMs?: number; key?: string },
): Promise<boolean> {
  const limit = options?.limit ?? 10;
  const windowMs = options?.windowMs ?? 15 * 60 * 1000;

  const ip = await clientIp();
  const key = `${action}:${ip}${options?.key ? `:${options.key}` : ""}`;
  const now = Date.now();

  sweep(windowMs);

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}
