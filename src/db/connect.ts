import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Postgres via DATABASE_URL.
 * - Neon (production): Neon's serverless driver over WebSockets. Cloudflare Workers can't do postgres.js's TLS upgrade,
 *   and this driver also supports transactions.
 * - Anything else (local PGlite socket server, plain Postgres): postgres.js.
 */
export function createDb(raw = process.env.DATABASE_URL): DB {
  if (!raw) throw new Error("DATABASE_URL is not set. Start the app with `npm run dev` (it runs a local database) or set DATABASE_URL.");
  const url = raw.trim().replace(/^["']|["']$/g, "");
  const host = new URL(url).hostname;
  if (host.endsWith(".neon.tech")) {
    const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 5) });
    // Same query builder API as postgres.js for everything this app uses.
    return drizzleNeon(pool, { schema }) as unknown as DB;
  }
  const client = postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 5), prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return drizzle(client, { schema });
}
