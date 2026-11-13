/**
 * Tiny in-memory cache for catalogue reads, so a rush of shoppers doesn't turn into a rush of
 * database queries. Each server instance (or Cloudflare isolate) keeps its own copy for a few
 * seconds; concurrent misses share one query. Admin changes and paid orders clear it.
 * Checkout never trusts it: prices and stock are re-read from the database there.
 */
type Entry = { at: number; value?: unknown; pending?: Promise<unknown> };
// On globalThis so every bundle in the same process (API routes, pages) shares one cache and one "clear".
const g = globalThis as unknown as { __vvCache?: { store: Map<string, Entry>; generation: number } };
const shared = (g.__vvCache ??= { store: new Map(), generation: 0 });
const store = shared.store;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit?.value !== undefined && now - hit.at < ttlMs) return hit.value as T;
  if (hit?.pending) return hit.pending as Promise<T>;
  const gen = shared.generation;
  const pending = load().then(
    (value) => {
      if (gen === shared.generation) store.set(key, { at: Date.now(), value });
      else store.delete(key);
      return value;
    },
    (err) => {
      store.delete(key);
      throw err;
    },
  );
  store.set(key, { at: hit?.at ?? 0, value: hit?.value, pending });
  return pending;
}

export function clearCache() {
  shared.generation++;
  // Also drop the shared catalogue copy in Redis (fire and forget; it expires in 60s anyway).
  void import("./redis").then((r) => r.redisDel("cache:store-products:v1")).catch(() => {});
  store.clear();
}
