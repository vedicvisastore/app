export const env = {
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
  authSecret: () => {
    const s = process.env.AUTH_SECRET;
    if (!s || s === "change-me") {
      if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set");
      return "dev-secret";
    }
    return s;
  },
  adminEmails: () =>
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  razorpay: () => ({
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  }),
  razorpayConfigured: () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  /** Mock payments only when Razorpay keys are absent AND we're not in production. */
  mockPayments: () =>
    process.env.ALLOW_MOCK_PAYMENTS === "1" &&
    process.env.NODE_ENV !== "production" &&
    !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  /** Hosts allowed to send state-changing requests (CSRF guard). */
  allowedHosts: () => {
    const hosts = new Set<string>();
    try { hosts.add(new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").host); } catch {}
    if (process.env.ADMIN_HOST) hosts.add(process.env.ADMIN_HOST);
    return hosts;
  },
  r2: () => ({
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
    publicUrl: (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
  }),
  r2Configured: () =>
    !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL),
  resendKey: () => process.env.RESEND_API_KEY ?? "",
  /** Until your domain is verified in Resend, use their shared sender. */
  emailFrom: () => {
    const f = process.env.EMAIL_FROM ?? "";
    return !f || f.includes("yourdomain") ? "VedicVisa <onboarding@resend.dev>" : f;
  },
  shippingWebhookSecret: () => process.env.SHIPPING_WEBHOOK_SECRET ?? "",
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
};
