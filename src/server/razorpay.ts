import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function createRazorpayOrder(amount: number, receipt: string, notes: Record<string, string>) {
  const { keyId, keySecret } = env.razorpay();
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency: "INR", receipt, notes }),
  });
  if (!res.ok) {
    console.error("Razorpay order failed", res.status, await res.text());
    throw new Error("Payment couldn't be started. Try again in a moment.");
  }
  return (await res.json()) as { id: string; amount: number; currency: string };
}

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", env.razorpay().keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret) */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = env.razorpay().webhookSecret;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
