import { eq } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { orderItems, orders } from "@/db/schema";
import { INDIA_POST_TRACK_URL, inr } from "@/lib/utils";
import { env } from "./env";

/** Escape customer-supplied text before it goes into email HTML. */
const esc = (v: string | null | undefined) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends through Resend (free tier: 3,000 emails/month). Returns false instead of throwing. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = env.resendKey();
  if (!key) {
    if (!env.isProd) console.log(`\n  ✉  [email not sent, no RESEND_API_KEY] to ${to}: ${subject}\n`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom(), to: [to], subject, html }),
    });
    if (!res.ok) console.warn(`Resend refused (${res.status}) for ${to}: ${await res.text().catch(() => "")}`);
    return res.ok;
  } catch (e) {
    console.warn("Resend error", e);
    return false;
  }
}

const shell = (body: string) => `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;padding:28px 24px;color:#14236b;line-height:1.55">
  <p style="font-size:22px;font-weight:700;margin:0 0 4px">VedicVisa</p>
  <p style="color:#d0197a;margin:0 0 24px">धार्यते इति धर्मः</p>
  ${body}
  <p style="font-size:12px;color:#7c86ad;margin-top:32px">You're receiving this because you placed an order at VedicVisa.</p></div>`;

async function load(db: DB, orderId: number) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { o, items };
}

export async function sendOrderConfirmation(db: DB, orderId: number) {
  const data = await load(db, orderId);
  if (!data) return;
  const { o, items } = data;
  const rows = items
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.qty}</td><td style="text-align:right">${inr(i.lineTotal)}</td></tr>`)
    .join("");
  const a = o.shippingAddress;
  await sendEmail(
    o.email,
    `Order ${o.number} confirmed`,
    shell(`<p style="font-size:17px">Hare Krishna, ${esc(a.name.split(" ")[0])}! We've received your order and payment.</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px;margin:16px 0">${rows}
      <tr><td style="padding-top:10px;border-top:1px solid #dbe5ef;font-weight:700">Total paid</td><td style="padding-top:10px;border-top:1px solid #dbe5ef;text-align:right;font-weight:700">${inr(o.total)}</td></tr></table>
      <p style="font-size:14px;color:#4a5687">Shipping to ${esc(a.name)}, ${esc(a.line1)}, ${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}</p>
      <p><a href="${env.siteUrl()}/account/orders/${o.number}" style="display:inline-block;background:#1f3fbf;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:600">View your order</a></p>`),
  );
}

export async function sendShippedEmail(db: DB, orderId: number) {
  const data = await load(db, orderId);
  if (!data?.o.trackingNumber) return;
  const { o } = data;
  await sendEmail(
    o.email,
    `Order ${o.number} has shipped`,
    shell(`<p style="font-size:17px">Your order is on its way with ${esc(o.carrier)}.</p>
      <p style="font-size:14px;color:#4a5687;margin-bottom:4px">Tracking number</p>
      <p style="font-size:22px;font-weight:700;letter-spacing:2px;margin-top:0">${esc(o.trackingNumber)}</p>
      <p><a href="${INDIA_POST_TRACK_URL}" style="display:inline-block;background:#1f3fbf;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:600">Track on India Post</a></p>
      <p style="font-size:14px"><a href="${env.siteUrl()}/account/orders/${o.number}" style="color:#1f3fbf">See order details</a></p>`),
  );
}
