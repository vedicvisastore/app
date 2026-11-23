/**
 * Site look and copy: the active theme and any edited text, saved as ONE JSON file
 * (`site/config.json` in the R2 bucket; `~/.vedicvisa/site-config.json` in local dev when R2 isn't set up).
 * No database involved. Reads are cached in memory for 5 seconds, so pages never wait on storage.
 */
import { AwsClient } from "aws4fetch";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DEFAULT_CONTENT, mergeContent, type SiteContent } from "@/content/defaults";
import { DEFAULT_CUSTOM, themeCss, themeTokens, THEMES, type CustomTheme } from "@/lib/themes";
import { clearCache, sharedCached } from "./cache";
import { tag } from "@/lib/stega";
import { mergeImages, type SiteImages } from "@/content/images";
import { env } from "./env";

export type SiteConfig = { theme: string; customTheme: CustomTheme; content: Record<string, string>; images?: Record<string, string>; updatedAt?: string };
const EMPTY: SiteConfig = { theme: "vrindavan", customTheme: DEFAULT_CUSTOM, content: {} };
const KEY = "site/config.json";

// Workers can access their bound bucket directly. Theme and copy saves must not
// depend on the separate S3 credentials used to sign browser media uploads.
type ConfigBucket = {
  get(key: string): Promise<{ json<T>(): Promise<T> } | null>;
  put(key: string, value: string, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
};

function boundBucket(): ConfigBucket | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as typeof env & { SITE_CONFIG_BUCKET?: ConfigBucket }).SITE_CONFIG_BUCKET;
  } catch {
    // Standalone Node and ordinary next dev have no Worker context.
    return undefined;
  }
}

export function siteConfigStorage() {
  return boundBucket() || env.r2Configured() ? "r2" : env.isProd ? "unconfigured" : "local";
}

function r2() {
  const c = env.r2();
  const client = new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, service: "s3", region: "auto" });
  return { client, url: `https://${c.accountId}.r2.cloudflarestorage.com/${c.bucket}/${KEY}` };
}

async function localPath() {
  const { homedir } = await import("node:os");
  return `${process.env.PGLITE_DIR ? process.env.PGLITE_DIR + "/.." : homedir() + "/.vedicvisa"}/site-config.json`;
}

async function readRaw(): Promise<SiteConfig> {
  try {
    const bucket = boundBucket();
    if (bucket) {
      const object = await bucket.get(KEY);
      return object ? { ...EMPTY, ...(await object.json<Partial<SiteConfig>>()) } : EMPTY;
    }
    if (env.r2Configured()) {
      const { client, url } = r2();
      const res = await client.fetch(url);
      if (res.status === 404) return EMPTY;
      if (!res.ok) throw new Error(`R2 ${res.status}`);
      return { ...EMPTY, ...((await res.json()) as Partial<SiteConfig>) };
    }
    if (env.isProd) return EMPTY;
    const { readFile } = await import("node:fs/promises");
    return { ...EMPTY, ...JSON.parse(await readFile(await localPath(), "utf8")) };
  } catch (e) {
    if (!String(e).includes("ENOENT")) console.warn("site config read failed, using defaults:", e);
    return EMPTY;
  }
}

export function getSiteConfig(): Promise<SiteConfig> {
  // Saved text, theme and pictures: memory 10 s, then Redis until the next save (which clears both).
  return sharedCached("site-config", { memoryMs: 10_000 }, readRaw);
}

export async function saveSiteConfig(next: SiteConfig) {
  const body = JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2);
  const bucket = boundBucket();
  if (bucket) {
    await bucket.put(KEY, body, { httpMetadata: { contentType: "application/json" } });
  } else if (env.r2Configured()) {
    const { client, url } = r2();
    const res = await client.fetch(url, { method: "PUT", body, headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`Couldn't save to R2 (${res.status}).`);
  } else {
    if (env.isProd) throw new Error("R2 storage isn't configured.");
    const { mkdir, writeFile } = await import("node:fs/promises");
    const p = await localPath();
    await mkdir(p.replace(/\/[^/]+$/, ""), { recursive: true });
    await writeFile(p, body, "utf8");
  }
  await clearCache();
}

/** What every page needs: merged copy and the theme CSS. */
export async function getSite(): Promise<{ content: SiteContent; images: SiteImages; themeKey: string; themeCss: string; previewing: boolean; editing: boolean }> {
  const [cfg, { draft, edit }] = await Promise.all([getSiteConfig().catch(() => EMPTY), import("./content-preview").then((m) => m.requestAdminView())]);
  const key = cfg.theme === "custom" || THEMES.some((t) => t.key === cfg.theme) ? cfg.theme : "vrindavan";
  // An admin previewing unsaved text in Admin → Store text sees the draft instead of the saved text.
  const text = draft ?? cfg.content;
  const merged = text ? mergeContent(text) : DEFAULT_CONTENT;
  // Visual editor: every text carries its key invisibly, so the admin can click it in the store to edit it.
  const content = edit ? (Object.fromEntries(Object.entries(merged).map(([g, fields]) => [g, Object.fromEntries(Object.entries(fields as Record<string, string>).map(([f, v]) => [f, tag(v, `${g}.${f}`)]))])) as SiteContent) : merged;
  return { content, images: mergeImages(cfg.images), themeKey: key, themeCss: themeCss(themeTokens(key, cfg.customTheme), "html:root"), previewing: !!draft && JSON.stringify(Object.entries(draft).sort()) !== JSON.stringify(Object.entries(cfg.content ?? {}).filter(([, v]) => v.trim()).sort()), editing: edit };
}
