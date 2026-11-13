/**
 * Fixed-window rate limits.
 *   shared: true  → counted in Redis, so the limit holds across every server instance (login codes, checkout).
 *   shared: false → counted in this instance's memory: free, for high-volume reads (cart quotes, pincode lookups).
 * If Redis is unreachable, shared limits fall back to memory rather than blocking customers.
 */
import { TRPCError } from "@trpc/server";
import { redisPipeline } from "./redis";

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __vvRate?: Map<string, Bucket> };
const mem = (g.__vvRate ??= new Map());

function memoryHit(key: string, windowSec: number) {
  const now = Date.now();
  let b = mem.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowSec * 1000 };
    mem.set(key, b);
    if (mem.size > 50_000) for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k);
  }
  b.count++;
  return { count: b.count, resetIn: Math.ceil((b.resetAt - now) / 1000) };
}

export type Limit = { name: string; limit: number; windowSec: number; shared?: boolean };

export async function hit(l: Limit, id: string) {
  const key = `rl:${l.name}:${id}:${Math.floor(Date.now() / 1000 / l.windowSec)}`;
  if (l.shared) {
    const r = await redisPipeline([
      ["INCR", key],
      ["EXPIRE", key, l.windowSec],
    ]);
    const n = r?.[0]?.result;
    if (typeof n === "number") return { ok: n <= l.limit, count: n, resetIn: l.windowSec };
  }
  const m = memoryHit(key, l.windowSec);
  return { ok: m.count <= l.limit, count: m.count, resetIn: m.resetIn };
}

/** Throws a friendly TOO_MANY_REQUESTS error when over the limit. */
export async function enforce(l: Limit, id: string, message = "Too many tries. Please wait a few minutes and try again.") {
  const r = await hit(l, id);
  if (!r.ok) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
}

export const LIMITS = {
  otpRequestIp: { name: "otp-ip", limit: 8, windowSec: 600, shared: true },
  otpVerifyIp: { name: "otp-verify-ip", limit: 25, windowSec: 600, shared: true },
  checkoutUser: { name: "checkout", limit: 12, windowSec: 600, shared: true },
  couponIp: { name: "coupon-ip", limit: 40, windowSec: 600, shared: true },
  quoteIp: { name: "quote-ip", limit: 240, windowSec: 60 },
  pincodeIp: { name: "pincode-ip", limit: 40, windowSec: 60 },
  trackIp: { name: "track-ip", limit: 20, windowSec: 600 },
  apiIp: { name: "api-ip", limit: 600, windowSec: 60 },
} satisfies Record<string, Limit>;
