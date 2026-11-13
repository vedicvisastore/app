/**
 * Standalone tRPC HTTP server (no Next.js). Useful if you want the API on its own box
 * (e.g. an Oracle Cloud "Always Free" VM) while the storefront is hosted elsewhere.
 *   npm run api   → http://localhost:4000/api/trpc
 */
import "dotenv/config";
import { createServer } from "node:http";
import { scriptDb } from "./db";
import { handleApi } from "../src/server/http";

const port = Number(process.env.PORT ?? 4000);
const allowOrigin = process.env.CORS_ORIGIN ?? "";

async function main() {
const { db } = await scriptDb();

createServer(async (req, res) => {
  try {
    const origin = req.headers.origin ?? "";
    if (allowOrigin && origin === allowOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "content-type, trpc-accept, x-trpc-source");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return void res.writeHead(204).end();

    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });

    const response = await handleApi(request, db);
    const setCookies = response.headers.getSetCookie();
    response.headers.forEach((v, k) => k !== "set-cookie" && res.setHeader(k, v));
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
    res.writeHead(response.status);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end("Internal error");
  }
}).listen(port, () => console.log(`tRPC HTTP server on http://localhost:${port}/api/trpc`));
}
main();
