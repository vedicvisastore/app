import { scriptDb } from "./db";

async function main() {
  const { db, kind } = await scriptDb();
  if (kind === "postgres" && /\.neon\.tech/.test(process.env.DATABASE_URL ?? "")) {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  } else if (kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  }
  console.log(`✓ Migrations applied (${kind})`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
