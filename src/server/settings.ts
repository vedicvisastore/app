import { clearCache, sharedCached } from "./cache";
import type { DB } from "@/db/connect";
import { settings } from "@/db/schema";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/settings-defaults";

export function getSettings(db: DB): Promise<StoreSettings> {
  // Read on every page (layout): memory 30 s, then Redis until an admin changes something.
  return sharedCached("settings", { memoryMs: 30_000 }, () => loadSettings(db));
}

async function loadSettings(db: DB): Promise<StoreSettings> {
  const rows = await db.select().from(settings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  // Before the store got its own account, the "instagram" setting held the creator's profile (@vedicvisa).
  if (!rows.some((r) => r.key === "creatorInstagram") && /instagram\.com\/vedicvisa\/?$|^@?vedicvisa$/i.test(String(out.instagram ?? ""))) {
    out.creatorInstagram = out.instagram;
    out.instagram = DEFAULT_SETTINGS.instagram;
  }
  // Stores saved before the ribbon editor existed: build the list from the old one-line text.
  if (!rows.some((r) => r.key === "ribbon") && rows.some((r) => r.key === "announcement"))
    out.ribbon = String(out.announcement).split("·").map((t) => t.trim()).filter(Boolean).map((text) => ({ text }));
  return out as StoreSettings;
}

export async function saveSettings(db: DB, patch: Partial<StoreSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  await clearCache();
}
