/**
 * Site look and copy: the active theme and any edited text, saved as ONE JSON file
 * (`site/config.json` in the R2 bucket; `~/.vedicvisa/site-config.json` in local dev when R2 isn't set up).
 * No database involved. Reads are cached in memory for 30 seconds, so pages never wait on storage.
 */
import { AwsClient } from "aws4fetch";
import { DEFAULT_CONTENT, mergeContent, type SiteContent } from "@/content/defaults";
import { DEFAULT_CUSTOM, themeCss, themeTokens, THEMES, type CustomTheme } from "@/lib/themes";
import { cached, clearCache } from "./cache";
import { env } from "./env";

export type SiteConfig = { theme: string; customTheme: CustomTheme; content: Record<string, string>; updatedAt?: string };
const EMPTY: SiteConfig = { theme: "vrindavan", customTheme: DEFAULT_CUSTOM, content: {} };
const KEY = "site/config.json";

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
  return cached("site-config", 30_000, readRaw);
}

export async function saveSiteConfig(next: SiteConfig) {
  const body = JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2);
  if (env.r2Configured()) {
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
  clearCache();
}

/** What every page needs: merged copy and the theme CSS. */
export async function getSite(): Promise<{ content: SiteContent; themeKey: string; themeCss: string }> {
  const cfg = await getSiteConfig().catch(() => EMPTY);
  const key = cfg.theme === "custom" || THEMES.some((t) => t.key === cfg.theme) ? cfg.theme : "vrindavan";
  return { content: cfg.content ? mergeContent(cfg.content) : DEFAULT_CONTENT, themeKey: key, themeCss: themeCss(themeTokens(key, cfg.customTheme), "html:root") };
}
