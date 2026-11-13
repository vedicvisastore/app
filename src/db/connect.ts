import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

/** Postgres via DATABASE_URL: Neon in production, the local PGlite socket server during `npm run dev`. */
export function createDb(url = process.env.DATABASE_URL): DB {
  if (!url) throw new Error("DATABASE_URL is not set. Start the app with `npm run dev` (it runs a local database) or set DATABASE_URL.");
  const client = postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 5), prepare: false, idle_timeout: 20 });
  return drizzle(client, { schema });
}
