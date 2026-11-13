import "server-only";
import { createDb, type DB } from "./connect";
import * as schema from "./schema";

const g = globalThis as unknown as { __vvdb?: DB };
const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
const perRequest = new WeakMap<object, DB>();

/**
 * Node (dev / VPS): one pooled client for the process.
 * Cloudflare Workers: sockets can't be shared across requests, so each request gets its own
 * client, keyed by the request's ExecutionContext.
 */
function current(): DB {
  if (!onWorkers) return (g.__vvdb ??= createDb());
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
  const { ctx, env } = getCloudflareContext();
  let db = perRequest.get(ctx);
  if (!db) {
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
    db = createDb(hyperdrive?.connectionString ?? process.env.DATABASE_URL);
    perRequest.set(ctx, db);
  }
  return db;
}

/** Connects on first use (not at import), so builds don't need a database. */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = current();
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
export { schema };
export type { DB };
