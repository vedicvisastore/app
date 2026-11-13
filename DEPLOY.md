# Deploying VedicVisa

Target: Cloudflare Workers (site + API + admin) · Neon (Postgres) · Cloudflare R2 (media) · Resend (email) · Razorpay (payments).
Checked 2026-11-13: the Worker bundle is **2.07 MB gzipped**, under the 3 MB free-plan limit (keep an eye on it as features grow).

## Day 1: accounts and domain (about 2–3 h, mostly waiting)
1. **Cloudflare:** create an account, add `vedicvisa.com`, switch the nameservers at your registrar to the two Cloudflare gives you. Propagation takes minutes to a few hours.
2. **Razorpay:** finish KYC and website verification for **live mode** (can take 1–3 working days, start now). Razorpay needs the live site to show: contact details, Shipping and returns, Terms, Privacy and Refund policy pages (see "Before Razorpay review" below).
3. **Neon:** create a project in the region closest to India (Singapore, or Mumbai if offered). Copy the **pooled** connection string.
4. **Resend:** add `vedicvisa.com`, add the DNS records it shows (in Cloudflare DNS), wait for "Verified".
5. **Google Cloud:** create a **new** OAuth client (the old secret was exposed). Authorised redirect URIs:
   `https://vedicvisa.com/api/auth/google/callback`, `https://admin.vedicvisa.com/api/auth/google/callback`, `http://localhost:3000/api/auth/google/callback`.

## Day 2: infrastructure (about 3 h)
1. **Database**
   ```bash
   DATABASE_URL="<neon pooled url>" npm run db:migrate
   DATABASE_URL="<neon pooled url>" npm run db:seed        # products from data/VedicvisaStore.xlsx, settings, sample coupon
   DATABASE_URL="<neon pooled url>" npm run db:pincodes    # India Post pincode map for analytics
   ```
   Then delete or edit the sample coupon `JAISHRIKRISHNA` in Admin if you don't want it live.
2. **R2:** create bucket `vedicvisa-media`. Settings → Custom domain → `media.vedicvisa.com`. CORS policy:
   ```json
   [{ "AllowedOrigins": ["https://admin.vedicvisa.com", "https://vedicvisa.com"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
   Create an R2 API token (Object Read & Write, this bucket only).
3. **Worker secrets** (`npx wrangler login` first):
   ```bash
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put AUTH_SECRET            # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   npx wrangler secret put ADMIN_EMAILS           # comma-separated
   npx wrangler secret put RESEND_API_KEY         # a NEW key
   npx wrangler secret put EMAIL_FROM             # VedicVisa <hello@vedicvisa.com>
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put R2_ACCOUNT_ID
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   npx wrangler secret put R2_BUCKET              # vedicvisa-media
   npx wrangler secret put R2_PUBLIC_URL          # https://media.vedicvisa.com
   npx wrangler secret put SHIPPING_WEBHOOK_SECRET   # optional, for a courier later
   ```
   Do **not** set `ALLOW_MOCK_PAYMENTS` in production.
   Non-secret vars live in `wrangler.jsonc` (`NEXT_PUBLIC_SITE_URL`, `COOKIE_DOMAIN`, `DB_POOL_MAX`).
4. **First deploy (Razorpay test keys):**
   ```bash
   npx wrangler secret put RAZORPAY_KEY_ID        # rzp_test_...
   npx wrangler secret put RAZORPAY_KEY_SECRET
   npm run cf:deploy
   ```
   Never run `cf:build`/`next build` while `npm run dev` is running locally (see AI_CONTEXT.md).
5. **Domains:** Workers → `vedicvisa` → Settings → Domains & Routes → add custom domains `vedicvisa.com`, `www.vedicvisa.com`, `admin.vedicvisa.com`. Add a redirect rule www → apex.

## Day 3: test on the real site (about 3 h)
Use Razorpay test mode:
- [ ] Home, shop, product pages load fast on mobile data; images come from media.vedicvisa.com
- [ ] Log in with email code (arrives from hello@vedicvisa.com) and with Google
- [ ] Admin at admin.vedicvisa.com: vedicvisa.com/admin redirects there; one login works on both
- [ ] Upload a product photo and a video; reorder; it shows in the store
- [ ] Coupon + auto offer + free shipping threshold give the right total
- [ ] Test payment succeeds (UPI test VPA `success@razorpay`); order shows paid; stock ledger shows "Sold"; confirmation email arrives
- [ ] Failed payment and closing the payment window: retry reuses the same order
- [ ] Razorpay webhook: Dashboard → Webhooks → `https://vedicvisa.com/api/webhooks/razorpay`, events `payment.captured`, `order.paid`, secret → `npx wrangler secret put RAZORPAY_WEBHOOK_SECRET`; redeploy; Admin → Settings shows it connected
- [ ] Mark packed → add India Post number → shipped (email arrives) → delivered
- [ ] Analytics map shows the test orders; then cancel/refund test orders with "put back in stock"

## Day 4: go live (about 2 h)
1. Razorpay live keys → `wrangler secret put RAZORPAY_KEY_ID/SECRET`, new **live** webhook + secret, `npm run cf:deploy`.
2. One real ₹1 order end to end (temporarily price a product at ₹1, then put it back), refund it from Razorpay.
3. **Cloudflare protection:** Security → WAF → Rate limiting rule (free plan allows one): path contains `/api/trpc/auth.requestOtp` or `/api/trpc/cart.quote`, 30 requests / 10 s per IP → block 1 min. Turn on Bot Fight Mode.
4. Admin → Settings: announcement text, shipping fee and free-shipping threshold, support phone.
5. Upload real product photos; mark unreleased products "Launching soon".

## Before Razorpay review
Pages Razorpay usually checks for: Contact (email, phone, address), Shipping and returns (exists: /shipping), Terms and conditions, Privacy policy, Cancellation and refund policy, product prices in ₹. Terms, Privacy and Refund pages are **not built yet**: write the text (or get it reviewed) and add them.

## Costs at launch
Everything above is free except the domain renewal and Razorpay's per-payment fee (about 2%).
When to pay: Workers Paid ($5/month) when daily requests near 100k or before a big Instagram drop; Neon Launch when compute hours run out (~100 CU-h/month free).

## CI/CD (GitHub Actions, `.github/workflows/ci.yml`)
- Every pull request and push: `npm ci` → typecheck → production build check.
- Every push to `main` (or "Run workflow" by hand): the checks, then **migrate the Neon database**, build for Workers and **deploy**.
- GitHub repo → Settings → Secrets and variables → Actions:
  - `CLOUDFLARE_API_TOKEN`: Cloudflare → My Profile → API Tokens → Create → template "Edit Cloudflare Workers" (add R2 edit permission too).
  - `CLOUDFLARE_ACCOUNT_ID`: `4ebac1de692a72c4dfbf340e5b10cee5`
  - `DATABASE_URL`: the Neon pooled connection string (used only for migrations; the live site reads its own copy from the Worker secret).
- Runtime keys (Razorpay, Resend, Google, R2, AUTH_SECRET…) live in Cloudflare as Worker secrets, not in GitHub: `npx wrangler secret bulk .env.production`.
- The deploy job uses the GitHub environment `production`; add yourself as a required reviewer there if you want to approve each deploy.

## Rollback
`npx wrangler deployments list` then `npx wrangler rollback <id>`. Database changes are forward-only migrations; take a Neon branch snapshot before running `db:migrate` on production.
