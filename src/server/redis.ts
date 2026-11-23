/**
 * Upstash Redis over its REST API (works on Cloudflare Workers, no TCP needed). Used for:
 *   - shared rate limits on login codes, coupon tries and checkout (rate-limit.ts)
 *   - the shared store cache: settings, site text/pictures, catalogue, categories, custom pages, live
 *     discounts and product pages, kept until an admin change or a scheduled change (cache.ts)
 *   - signed-in sessions (2 min), pincode lookups (30 days), product view counters
 * Everything degrades gracefully: without Redis, limits and caches fall back to per-instance memory.
 */
const URL_ = () => process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "") ?? "";
const TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
export const redisEnabled = () => !!(URL_() && TOKEN());

type Reply = { result?: unknown; error?: string };

export async function redisPipeline(cmds: (string | number)[][]): Promise<Reply[] | null> {
  if (!redisEnabled()) return null;
  try {
    const res = await fetch(`${URL_()}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return (await res.json()) as Reply[];
  } catch {
    return null; // Redis trouble must never take the store down
  }
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const r = await redisPipeline([["GET", key]]);
  const v = r?.[0]?.result;
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds: number) {
  await redisPipeline([["SET", key, JSON.stringify(value), "EX", ttlSeconds]]);
}

export async function redisDel(...keys: string[]) {
  if (keys.length) await redisPipeline([["DEL", ...keys]]);
}
