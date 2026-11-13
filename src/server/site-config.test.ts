import assert from "node:assert/strict";
import { test } from "node:test";
import { clearCache } from "./cache";
import { getSiteConfig, saveSiteConfig, siteConfigStorage } from "./site-config";

test("production theme storage works through the Worker bucket without S3 keys", async (t) => {
  const symbol = Symbol.for("__cloudflare-context__");
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previousContext = globals[symbol];
  const keys = ["NODE_ENV", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
  const previousEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const objects = new Map<string, string>();
  let writes = 0;
  let rejectWrite = false;
  const bucket = {
    async get(key: string) {
      const body = objects.get(key);
      return body === undefined ? null : { async json() { return JSON.parse(body); } };
    },
    async put(key: string, body: string, options: { httpMetadata: { contentType: string } }) {
      assert.equal(key, "site/config.json");
      assert.equal(options.httpMetadata.contentType, "application/json");
      if (rejectWrite) throw new Error("storage unavailable");
      objects.set(key, body);
      writes++;
    },
  };
  Object.assign(process.env, { NODE_ENV: "production", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" });
  globals[symbol] = { env: { SITE_CONFIG_BUCKET: bucket } };
  clearCache();
  try {
    await t.test("a new bucket returns defaults and reports R2 storage", async () => {
      assert.equal(siteConfigStorage(), "r2");
      assert.equal((await getSiteConfig()).theme, "vrindavan");
    });
    await t.test("saving a theme preserves copy and invalidates cached defaults", async () => {
      const initial = await getSiteConfig();
      await saveSiteConfig({ ...initial, theme: "yamuna", content: { "home.heroTitle": "A saved headline" } });
      const saved = await getSiteConfig();
      assert.equal(saved.theme, "yamuna");
      assert.equal(saved.content["home.heroTitle"], "A saved headline");
      assert.equal(writes, 1);
      assert.ok(saved.updatedAt && !Number.isNaN(Date.parse(saved.updatedAt)));
    });
    await t.test("a failed save surfaces the error and keeps the previous config", async () => {
      rejectWrite = true;
      const saved = await getSiteConfig();
      await assert.rejects(saveSiteConfig({ ...saved, theme: "rani" }), /storage unavailable/);
      assert.equal((await getSiteConfig()).theme, "yamuna");
      assert.equal(writes, 1);
    });
    await t.test("production without a bucket or keys fails explicitly", async () => {
      globals[symbol] = { env: {} };
      assert.equal(siteConfigStorage(), "unconfigured");
      await assert.rejects(saveSiteConfig(await getSiteConfig()), /R2 storage isn't configured/);
    });
  } finally {
    if (previousContext === undefined) delete globals[symbol];
    else globals[symbol] = previousContext;
    clearCache();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
