/**
 * Two-level cache for store reads, so shoppers don't turn into database (and R2, and API) load.
 *
 *  1. Memory: each server instance (Cloudflare isolate) keeps a copy for a few seconds; concurrent misses share
 *     one load.
 *  2. Redis (Upstash, shared by every instance): `sharedCached` keeps the result for up to 15 minutes, or less
 *     when something is scheduled to change sooner (a sale starts, a product launches, a custom page ends).
 *
 * Invalidation: every admin change and every paid/cancelled/refunded order calls `clearCache()`, which empties
 * this instance's memory and bumps one Redis "generation" number. Each Redis entry remembers the generation it
 * was written in, and a read fetches the entry and the current generation in the same request, so after a
 * change no instance serves the old copy from Redis. Other instances' memory copies live at most `memoryMs`.
 *
 * Without Redis (local dev, or Redis down) everything falls back to memory only. Checkout never trusts any of
 * this for money: prices and stock are re-read there.
 */
import { redisEnabled, redisPipeline } from "./redis";

type Entry = { at: number; ttl: number; value?: unknown; pending?: Promise<unknown> };
// On globalThis so every bundle in the same process (API routes, pages) shares one cache and one "clear".
const g = globalThis as unknown as { __vvCache?: { store: Map<string, Entry>; generation: number } };
const shared = (g.__vvCache ??= { store: new Map(), generation: 0 });
const store = shared.store;

/** Keys are per site, so a dev machine pointed at the same Redis can never mix its data into the live store. */
const NS = () => `vv:${(process.env.NEXT_PUBLIC_SITE_URL ?? "dev").replace(/^https?:\/\//, "")}`;
const GEN_KEY = () => `${NS()}:gen`;
/** A Redis key in this site's namespace (for counters and other non-cache keys). */
export const nsKey = (name: string) => `${NS()}:${name}`;

export const MAX_SHARED_SECONDS = 15 * 60;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  return memo(key, ttlMs, load);
}

function memo<T>(key: string, ttlMs: number, load: () => Promise<T>, ttlOf?: (v: T) => number): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit?.value !== undefined && now - hit.at < hit.ttl) return Promise.resolve(hit.value as T);
  if (hit?.pending) return hit.pending as Promise<T>;
  const gen = shared.generation;
  const pending = load().then(
    (value) => {
      // Never keep a copy in memory past the moment it is due to change.
      const ttl = Math.min(ttlMs, ttlOf ? ttlOf(value) * 1000 : ttlMs);
      if (gen === shared.generation) store.set(key, { at: Date.now(), ttl, value });
      else store.delete(key);
      return value;
    },
    (err) => {
      store.delete(key);
      throw err;
    },
  );
  store.set(key, { at: hit?.at ?? 0, ttl: hit?.ttl ?? 0, value: hit?.value, pending });
  return pending;
}

type SharedOpts<T> = {
  /** How long each instance keeps its own copy. */
  memoryMs: number;
  /** Upper limit in Redis (seconds); defaults to 15 minutes. */
  maxSeconds?: number;
  /** Seconds until this value is due to change by itself (scheduled sale, launch…); caps both levels. */
  ttl?: (value: T) => number;
  /** JSON loses Dates: turn them back after reading from Redis. */
  revive?: (raw: unknown) => T;
};

/** Memory → Redis → `load()`. See the file comment. */
export function sharedCached<T>(key: string, opts: SharedOpts<T>, load: () => Promise<T>): Promise<T> {
  return memo(
    key,
    opts.memoryMs,
    async () => {
      if (!redisEnabled()) return load();
      const rkey = `${NS()}:c:${key}`;
      const got = await redisPipeline([["GET", GEN_KEY()], ["GET", rkey]]);
      const gen = Number(got?.[0]?.result ?? 0) || 0;
      const raw = got?.[1]?.result;
      if (typeof raw === "string") {
        try {
          const entry = JSON.parse(raw) as { g: number; v: unknown };
          if (entry.g === gen) return opts.revive ? opts.revive(entry.v) : (entry.v as T);
        } catch {
          /* fall through and reload */
        }
      }
      const value = await load();
      const seconds = Math.floor(Math.min(opts.maxSeconds ?? MAX_SHARED_SECONDS, opts.ttl ? opts.ttl(value) : Infinity));
      // Only store if the generation hasn't moved while we were loading (an admin change mid-load).
      if (got && seconds >= 1) {
        await redisPipeline([["SET", rkey, JSON.stringify({ g: gen, v: value }), "EX", seconds]]);
      }
      return value;
    },
    opts.ttl,
  );
}

/** Seconds until the earliest of these moments that is still in the future (15 minutes if none). */
export function secondsUntilNext(moments: (Date | string | null | undefined)[], now = Date.now()) {
  let best = MAX_SHARED_SECONDS;
  for (const m of moments) {
    if (!m) continue;
    const s = (new Date(m).getTime() - now) / 1000;
    if (s > 0 && s < best) best = s;
  }
  return Math.max(1, Math.ceil(best));
}

/** Drops every cached store read, here and (via the Redis generation) on every other instance. */
export async function clearCache() {
  shared.generation++;
  store.clear();
  await redisPipeline([["INCR", GEN_KEY()]]);
}
