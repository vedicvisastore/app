# VedicVisa store

Next.js 16 storefront + admin, tRPC API, Postgres (Neon), Razorpay, India Post shipping, Cloudflare Workers + R2.

## Run locally
```bash
npm install
npm run db:setup     # first time: migrations + seed from data/VedicvisaStore.xlsx (stop `npm run dev` first)
npm run dev          # starts a local Postgres (PGlite, stored in ~/.vedicvisa/pglite) and Next on :3000
```
- Admin: log in at /login with an email listed in `ADMIN_EMAILS`, then open /admin.
- Without Razorpay keys, checkout shows a "simulate payment" step (dev only).
- Login codes are printed in the terminal if the email can't be sent.

## Deploy for free
- **Cloudflare Workers** (free plan allows commercial use): `npx wrangler login`, set secrets with `npx wrangler secret put DATABASE_URL` (and AUTH_SECRET, RAZORPAY_*, RESEND_API_KEY, GOOGLE_*, R2_*), then `npm run cf:deploy`.
- **Neon** free Postgres: put its connection string in `DATABASE_URL`, run `DATABASE_URL=... npm run db:migrate`.
- **R2** for photos and videos: create a bucket, connect a custom domain (e.g. media.vedicvisa.com) so it is served through Cloudflare's CDN, allow PUT from your site in the bucket's CORS settings.
- Admin subdomain: add `admin.vedicvisa.com` as a route/custom domain on the same Worker; `npm run cf:build` builds with `ADMIN_HOST=admin.vedicvisa.com`.

## Webhooks
- Razorpay: `https://<site>/api/webhooks/razorpay` (events `payment.captured`, `order.paid`).
- Couriers (future Shiprocket etc.): `POST https://<site>/api/webhooks/shipping/<provider>` with header `x-webhook-secret`.
