/**
 * One fetch-style HTTP handler for the whole API:
 *   /api/trpc/*                       tRPC (store + admin)
 *   /api/webhooks/razorpay            Razorpay payment webhooks
 *   /api/webhooks/shipping/:provider  Generic shipping webhooks (Shiprocket etc., future)
 *   /api/upload                       Local media uploads (dev only; production uses R2 presigned URLs)
 *   /api/health
 * Mounted by Next.js (src/app/api/[...path]/route.ts), Cloudflare Workers, or the standalone Node server.
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { orderEvents, orders, webhookEvents, type OrderStatus } from "@/db/schema";
import { parseCookies, SESSION_COOKIE, userFromSessionToken } from "./auth";
import { env } from "./env";
import { googleCallback, googleStart } from "./google";
import { transitionOrder } from "./order-transition";
import { markOrderPaid } from "./orders";
import { verifyWebhookSignature } from "./razorpay";
import { appRouter } from "./root";
import { ALLOWED_MEDIA, mediaKey } from "./storage";
import { createContext } from "./trpc";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function handleApi(req: Request, db: DB): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method !== "GET" && req.method !== "HEAD" && !path.startsWith("/api/webhooks/")) {
    const origin = req.headers.get("origin");
    const sameHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin) {
      let host = "";
      try { host = new URL(origin).host; } catch {}
      if (host !== sameHost && !env.allowedHosts().has(host)) return json({ error: "Cross-site request blocked" }, 403);
    } else if (req.headers.get("sec-fetch-site") === "cross-site") {
      return json({ error: "Cross-site request blocked" }, 403);
    }
  }

  if (path.startsWith("/api/trpc")) {
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: ({ resHeaders }) =>
        createContext(db, req.headers.get("cookie"), (c) => resHeaders.append("Set-Cookie", c)),
      onError: ({ error, path: p }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC ${p}:`, error);
      },
    });
  }
  if (path === "/api/health") return json({ ok: true });
  if (path === "/api/auth/google") return googleStart(req);
  if (path === "/api/auth/google/callback") return googleCallback(req, db);
  if (path === "/api/webhooks/razorpay" && req.method === "POST") return razorpayWebhook(req, db);
  const ship = path.match(/^\/api\/webhooks\/shipping\/([a-z0-9_-]{2,30})$/);
  if (ship && req.method === "POST") return shippingWebhook(req, db, ship[1]);
  if (path === "/api/upload" && req.method === "POST") return localUpload(req, db);
  return json({ error: "Not found" }, 404);
}

async function razorpayWebhook(req: Request, db: DB) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) return json({ error: "Bad signature" }, 401);
  const evt = JSON.parse(raw) as {
    event: string;
    payload: { payment?: { entity: { id: string; order_id: string; status: string } }; order?: { entity: { id: string } } };
  };
  const [log] = await db.insert(webhookEvents).values({ provider: "razorpay", eventType: evt.event, payload: evt }).returning();
  try {
    if (evt.event === "payment.captured" || evt.event === "order.paid") {
      const rzpOrderId = evt.payload.payment?.entity.order_id ?? evt.payload.order?.entity.id;
      const [o] = rzpOrderId ? await db.select().from(orders).where(eq(orders.razorpayOrderId, rzpOrderId)).limit(1) : [];
      const paid = (evt.payload.payment?.entity as { amount?: number } | undefined)?.amount;
      if (o && paid !== undefined && paid !== o.total) {
        await db.update(webhookEvents).set({ error: `Amount mismatch: paid ${paid}, order ${o.total}` }).where(eq(webhookEvents.id, log.id));
        return json({ ok: true, flagged: true });
      }
      if (o) {
        const r = await markOrderPaid(db, o.id, evt.payload.payment?.entity.id ?? null, "webhook");
        if (!r.ok) await db.update(webhookEvents).set({ error: `Payment received but ${r.message} Refund it from Razorpay if needed.` }).where(eq(webhookEvents.id, log.id));
      }
    }
    await db.update(webhookEvents).set({ processed: true }).where(eq(webhookEvents.id, log.id));
  } catch (e) {
    await db.update(webhookEvents).set({ error: String(e) }).where(eq(webhookEvents.id, log.id));
    return json({ error: "Processing failed" }, 500);
  }
  return json({ ok: true });
}

/**
 * Accepts any JSON. Recognised fields (Shiprocket-style or our own):
 *   order_number | order_id | channel_order_id   → our order number (VV-XXXXXX)
 *   awb | tracking_number                        → tracking number
 *   status | current_status | shipment_status    → mapped to shipped / delivered / cancelled
 *   message | location | scans[]
 * Auth: header "x-webhook-secret" (or ?secret=) must equal SHIPPING_WEBHOOK_SECRET.
 */
async function shippingWebhook(req: Request, db: DB, provider: string) {
  const secret = env.shippingWebhookSecret();
  const given = req.headers.get("x-webhook-secret") ?? req.headers.get("x-api-key") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || given !== secret) return json({ error: "Unauthorized" }, 401);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const [log] = await db.insert(webhookEvents).values({ provider, eventType: String(body.event ?? body.current_status ?? body.status ?? ""), payload: body }).returning();

  const s = (k: string) => (body[k] == null ? undefined : String(body[k]));
  const number = s("order_number") ?? s("order_id") ?? s("channel_order_id");
  const awb = s("awb") ?? s("tracking_number");
  const rawStatus = (s("status") ?? s("current_status") ?? s("shipment_status") ?? "").toUpperCase();
  const status: OrderStatus | null = /DELIVERED/.test(rawStatus) && !/UNDELIVERED|RTO/.test(rawStatus)
    ? "delivered"
    : /CANCEL/.test(rawStatus)
      ? "cancelled"
      : /SHIPPED|TRANSIT|PICKED|DISPATCH|OUT FOR/.test(rawStatus)
        ? "shipped"
        : null;

  const [o] = number
    ? await db.select().from(orders).where(eq(orders.number, number)).limit(1)
    : awb
      ? await db.select().from(orders).where(eq(orders.trackingNumber, awb)).limit(1)
      : [];
  if (!o) {
    await db.update(webhookEvents).set({ error: "No matching order" }).where(eq(webhookEvents.id, log.id));
    return json({ ok: true, matched: false });
  }
  if (awb && !o.trackingNumber) await db.update(orders).set({ trackingNumber: awb }).where(eq(orders.id, o.id));
  const message = s("message") ?? (rawStatus ? `Courier update: ${rawStatus.toLowerCase()}` : "Courier update");
  // Couriers may only move an order along the shipping part of the lifecycle (paid/packed → shipped → delivered).
  const moved = status
    ? await transitionOrder(db, { orderId: o.id, to: status, actor: "courier", source: `webhook:${provider}`, trackingNumber: awb, message, location: s("location") ?? null })
    : null;
  if (!moved?.ok || !moved.changed) {
    // Not a lifecycle move (or not one a courier may make): keep it as a timeline note.
    await db.insert(orderEvents).values({ orderId: o.id, status: null, message, location: s("location") ?? null, source: `webhook:${provider}` });
    if (moved && !moved.ok) await db.update(webhookEvents).set({ error: moved.message }).where(eq(webhookEvents.id, log.id));
  }
  await db.update(webhookEvents).set({ processed: true }).where(eq(webhookEvents.id, log.id));
  return json({ ok: true, matched: true });
}

/** Dev-only fallback when R2 isn't configured. */
async function localUpload(req: Request, db: DB) {
  if (env.isProd || env.r2Configured()) return json({ error: "Use R2 uploads" }, 400);
  const user = await userFromSessionToken(db, parseCookies(req.headers.get("cookie"))[SESSION_COOKIE]);
  if (user?.role !== "admin") return json({ error: "Admins only" }, 403);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file" }, 400);
  const maxMb = ALLOWED_MEDIA[file.type];
  if (!maxMb || file.size > maxMb * 1024 * 1024) return json({ error: "Unsupported file or too large" }, 400);
  const key = mediaKey(file.name);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = `${process.cwd()}/public/uploads/${key.split("/").slice(0, -1).join("/")}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${process.cwd()}/public/uploads/${key}`, Buffer.from(await file.arrayBuffer()));
  return json({ url: `/uploads/${key}` });
}
