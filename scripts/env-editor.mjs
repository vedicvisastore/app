#!/usr/bin/env node
/**
 * Production settings editor (runs only on your laptop).
 *   npm run env:edit   → opens http://127.0.0.1:4545/?k=<one-time key>
 *
 * Edits `.env.production` and pushes changed values to the live Worker as encrypted Cloudflare secrets
 * through your own `wrangler login`. Nothing is hosted: no keys ever sit on a web page on the internet.
 * Values are hidden by default and never written to the terminal.
 */
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, chmodSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FILE = ".env.production";
const WORKER = "vedicvisa";
const PORT = Number(process.env.PORT ?? 4545);
const KEY = randomBytes(16).toString("hex");

const HELP = {
  DATABASE_URL: "Neon → project → Connection string → Pooled",
  AUTH_SECRET: "Random 64-character string that signs logins. Changing it logs everyone out.",
  ADMIN_EMAILS: "Comma-separated emails that get the admin panel",
  RAZORPAY_KEY_ID: "Razorpay → Settings → API keys (rzp_test_… or rzp_live_…)",
  RAZORPAY_KEY_SECRET: "Shown once when you generate the key",
  RAZORPAY_WEBHOOK_SECRET: "The secret you typed when creating the Razorpay webhook",
  RESEND_API_KEY: "resend.com → API keys",
  EMAIL_FROM: "e.g. VedicVisa <hello@vedicvisa.com>",
  GOOGLE_CLIENT_ID: "Google Cloud → Credentials → OAuth client",
  GOOGLE_CLIENT_SECRET: "Google Cloud → Credentials → OAuth client",
  R2_ACCOUNT_ID: "Cloudflare account ID",
  R2_ACCESS_KEY_ID: "Cloudflare → R2 → Manage API tokens",
  R2_SECRET_ACCESS_KEY: "Cloudflare → R2 → Manage API tokens",
  R2_BUCKET: "vedicvisa-media",
  R2_PUBLIC_URL: "https://media.vedicvisa.com",
  UPSTASH_REDIS_REST_URL: "Upstash → database → REST API",
  UPSTASH_REDIS_REST_TOKEN: "Upstash → database → REST API",
  COOKIE_DOMAIN: ".vedicvisa.com (shares the login between store and admin)",
  SHIPPING_WEBHOOK_SECRET: "Optional, for a courier webhook later",
};

function parse() {
  const out = [];
  if (!existsSync(FILE)) return out;
  for (const line of readFileSync(FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && v[0] === v.at(-1) && `"'`.includes(v[0])) v = v.slice(1, -1);
    out.push({ key: m[1], value: v });
  }
  return out;
}

function save(entries) {
  const lines = existsSync(FILE) ? readFileSync(FILE, "utf8").split("\n") : [];
  const left = new Map(entries.map((e) => [e.key, e.value]));
  const next = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (!m || !left.has(m[1])) return line;
    const v = left.get(m[1]);
    left.delete(m[1]);
    return `${m[1]}=${/[\s<>"#]/.test(v) ? JSON.stringify(v) : v}`;
  });
  for (const [k, v] of left) next.push(`${k}=${/[\s<>"#]/.test(v) ? JSON.stringify(v) : v}`);
  writeFileSync(FILE, next.join("\n"), { mode: 0o600 });
}

function wrangler(args) {
  return new Promise((resolve) => {
    execFile("npx", ["wrangler", ...args], { maxBuffer: 1 << 20, env: { ...process.env, FORCE_COLOR: "0" } }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout}\n${stderr}`.replace(/\u001b\[[0-9;]*m/g, "") }),
    );
  });
}

async function liveSecrets() {
  const r = await wrangler(["secret", "list", "--name", WORKER, "--format", "json"]);
  try {
    return JSON.parse(r.out.slice(r.out.indexOf("["), r.out.lastIndexOf("]") + 1)).map((s) => s.name);
  } catch {
    return null;
  }
}

async function push(pairs) {
  const dir = mkdtempSync(join(tmpdir(), "vv-env-"));
  const f = join(dir, "s.json");
  try {
    writeFileSync(f, JSON.stringify(Object.fromEntries(pairs.map((p) => [p.key, p.value]))));
    chmodSync(f, 0o600);
    const r = await wrangler(["secret", "bulk", f, "--name", WORKER]);
    return { ok: r.ok && /success/i.test(r.out), detail: r.ok ? `${pairs.length} pushed` : "wrangler failed: run `npx wrangler login` and try again" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const PAGE = /* html */ `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VedicVisa · production settings</title>
<style>
:root{--ink:#14236b;--soft:#4a5687;--line:#dbe5ef;--paper:#f6f9fc;--gold:#e8ad2f;--ok:#1b8452;--bad:#c2185b}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--paper);color:var(--ink)}
main{max-width:980px;margin:auto;padding:32px 20px}h1{margin:0 0 4px;font-size:28px}p.lede{color:var(--soft);margin:0 0 20px}
.bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;position:sticky;top:0;background:var(--paper);padding:10px 0;z-index:2}
button{font:inherit;font-weight:700;border:1.5px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:9px 16px;cursor:pointer}
button.primary{background:var(--gold);border-color:var(--gold)}button:disabled{opacity:.5;cursor:not-allowed}
button:focus-visible,input:focus-visible{outline:2.5px solid #1f3fbf;outline-offset:2px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
td,th{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}th{font-size:13px;color:var(--soft);font-weight:600}
td.k{font-family:ui-monospace,monospace;font-size:13px;white-space:nowrap}small{display:block;color:var(--soft);font-size:12px;margin-top:2px}
.val{display:flex;gap:6px}.val input{flex:1;min-width:0;font:13px ui-monospace,monospace;padding:8px 10px;border:1.5px solid #9aa6c4;border-radius:10px}
.val input.dirty{border-color:var(--gold);background:#fffaf0}.tag{font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap}
.live{background:#e2f4ea;color:var(--ok)}.missing{background:#fde7f2;color:var(--bad)}.local{background:#eef2f7;color:var(--soft)}
#msg{font-weight:600}.row-add td{background:#fbfcfe}
</style></head><body><main>
<h1>Production settings</h1>
<p class="lede">Edits <code>.env.production</code> on this laptop and pushes values to the live site as encrypted Cloudflare secrets. Values are hidden; click 👁 to reveal one. Changes reach the site within seconds of pushing.</p>
<div class="bar"><button class="primary" id="saveBtn">Save &amp; push changed to live</button><button id="saveOnly">Save to file only</button><button id="pushAll">Push everything to live</button><button id="reload">Reload</button><span id="msg" role="status"></span></div>
<table><thead><tr><th>Name</th><th>Value</th><th>Live site</th></tr></thead><tbody id="rows"></tbody>
<tbody><tr class="row-add"><td><input id="newKey" placeholder="NEW_NAME" style="font:13px ui-monospace,monospace;padding:8px;border:1.5px solid #9aa6c4;border-radius:10px;width:100%"></td><td class="val"><input id="newVal" type="password" placeholder="value"></td><td><button id="add">Add</button></td></tr></tbody></table>
</main><script>
const K=new URLSearchParams(location.search).get("k");const $=(s)=>document.querySelector(s);let state=[];
const api=(p,b)=>fetch(p+"?k="+K,b?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)}:{}).then(r=>r.json());
function render(){const rows=$("#rows");rows.innerHTML="";for(const e of state){const tr=document.createElement("tr");
const st=e.live===null?'<span class="tag local">unknown</span>':e.live?'<span class="tag live">set</span>':(e.value?'<span class="tag missing">not pushed</span>':'<span class="tag local">empty</span>');
tr.innerHTML='<td class="k"></td><td><div class="val"><input type="password" autocomplete="off" spellcheck="false"><button type="button" title="Show">👁</button></div><small></small></td><td>'+st+'</td>';
tr.querySelector(".k").textContent=e.key;const inp=tr.querySelector("input");inp.value=e.value;inp.oninput=()=>{e.value=inp.value;e.dirty=true;inp.classList.add("dirty")};
tr.querySelector("button").onclick=()=>{inp.type=inp.type==="password"?"text":"password"};tr.querySelector("small").textContent=e.help||"";rows.appendChild(tr)}}
async function load(){$("#msg").textContent="Loading…";const d=await api("/api/env");state=d.entries;render();$("#msg").textContent=d.live?"":"Couldn't read live secrets (run npx wrangler login).";}
async function act(push,all){const changed=state.filter(e=>e.dirty||all);$("#msg").textContent=push?"Pushing…":"Saving…";
document.querySelectorAll("button").forEach(b=>b.disabled=true);const r=await api("/api/save",{entries:state.map(({key,value})=>({key,value})),push:push?changed.filter(e=>e.value).map(e=>e.key):[]});
document.querySelectorAll("button").forEach(b=>b.disabled=false);await load();$("#msg").textContent=r.message;}
$("#saveBtn").onclick=()=>act(true,false);$("#saveOnly").onclick=()=>act(false,false);$("#pushAll").onclick=()=>act(true,true);$("#reload").onclick=load;
$("#add").onclick=()=>{const k=$("#newKey").value.trim().toUpperCase();if(!/^[A-Z][A-Z0-9_]{1,60}$/.test(k))return $("#msg").textContent="Names use A–Z, 0–9 and _";
state.push({key:k,value:$("#newVal").value,dirty:true,live:false});$("#newKey").value="";$("#newVal").value="";render();};load();
</script></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  // Only this browser tab (with the one-time key) may talk to the editor; nothing else on the machine or web.
  if (url.searchParams.get("k") !== KEY || (req.headers.host ?? "") !== `127.0.0.1:${PORT}`) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  const json = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'" });
    return res.end(PAGE);
  }
  if (url.pathname === "/api/env" && req.method === "GET") {
    const live = await liveSecrets();
    const keys = new Set([...parse().map((e) => e.key), ...Object.keys(HELP)]);
    const file = new Map(parse().map((e) => [e.key, e.value]));
    return json(200, { live: !!live, entries: [...keys].map((k) => ({ key: k, value: file.get(k) ?? "", help: HELP[k] ?? "", live: live ? live.includes(k) : null })) });
  }
  if (url.pathname === "/api/save" && req.method === "POST") {
    let body = "";
    for await (const c of req) body += c;
    const { entries, push: pushKeys } = JSON.parse(body);
    const clean = entries.filter((e) => /^[A-Z][A-Z0-9_]{1,60}$/.test(e.key) && typeof e.value === "string");
    save(clean);
    if (!pushKeys?.length) return json(200, { message: "Saved to .env.production." });
    const r = await push(clean.filter((e) => pushKeys.includes(e.key) && e.value));
    return json(200, { message: r.ok ? `Saved, and ${r.detail} to the live site.` : `Saved to file, but ${r.detail}.` });
  }
  json(404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  const link = `http://127.0.0.1:${PORT}/?k=${KEY}`;
  console.log(`\n  Production settings editor: ${link}\n  (local only; stop with Ctrl+C)\n`);
  execFile(process.platform === "darwin" ? "open" : "xdg-open", [link], () => {});
});
