/** DB for CLI scripts: DATABASE_URL if set, otherwise open the local PGlite files in ~/.vedicvisa/pglite directly (stop `npm run dev` first). */
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { createDb, type DB } from "../src/db/connect";
import * as schema from "../src/db/schema";

export async function scriptDb(): Promise<{ db: DB; kind: "postgres" | "pglite" }> {
  if (process.env.DATABASE_URL) return { db: createDb(), kind: "postgres" };
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  // Kept outside the project so the dev server's file watcher doesn't reload on every write.
  const dir = process.env.PGLITE_DIR ?? `${homedir()}/.vedicvisa/pglite`;
  mkdirSync(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema }) as unknown as DB;
  return { db, kind: "pglite" };
}
