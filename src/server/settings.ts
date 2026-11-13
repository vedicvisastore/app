import { cached, clearCache } from "./cache";
import type { DB } from "@/db/connect";
import { settings } from "@/db/schema";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/settings-defaults";

export function getSettings(db: DB): Promise<StoreSettings> {
  return cached("settings", 30_000, () => loadSettings(db));
}

async function loadSettings(db: DB): Promise<StoreSettings> {
  const rows = await db.select().from(settings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out as StoreSettings;
}

export async function saveSettings(db: DB, patch: Partial<StoreSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  clearCache();
}
