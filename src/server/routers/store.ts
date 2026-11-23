import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { addresses, orderEvents, orderItems, orders, users } from "@/db/schema";
import { clearSessionCookie, createSession, destroySession, forgetSession, requestOtp, sessionCookie, verifyOtp } from "../auth";
import { nsKey } from "../cache";
import { redisPipeline } from "../redis";
import { filterProducts, listStoreProducts, liveDiscounts, liveGroups, productDetail, storeCategories } from "../catalog";
import { festivalPage, liveFestivals } from "../festivals";
import { env } from "../env";
import { enforce, LIMITS } from "../rate-limit";
import { googleConfigured } from "../google";
import { createPendingOrder, expireStaleOrders, markOrderPaid } from "../orders";
import { quoteCart } from "../pricing";
import { createRazorpayOrder, verifyPaymentSignature } from "../razorpay";
import { getSettings } from "../settings";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const lineSchema = z.object({ productId: z.number().int().positive(), qty: z.number().int().min(1).max(20) });
const linesSchema = z.array(lineSchema).max(50);

const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(80),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")),
  line1: z.string().trim().min(3, "Enter house / flat and street").max(160),
  line2: z.string().trim().max(160).optional().nullable(),
  landmark: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Choose the state").max(60),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
});

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) =>
    ctx.user ? { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name, phone: ctx.user.phone, role: ctx.user.role } : null,
  ),
  requestOtp: publicProcedure.input(z.object({ email: z.email("Enter a valid email") })).mutation(async ({ ctx, input }) => {
    await enforce(LIMITS.otpRequestIp, ctx.ip, "Too many login codes from this network. Please wait 10 minutes.");
    await requestOtp(ctx.db, input.email);
    return { sent: true, devHint: !env.isProd };
  }),
  verifyOtp: publicProcedure
    .input(z.object({ email: z.email(), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }))
    .mutation(async ({ ctx, input }) => {
      await enforce(LIMITS.otpVerifyIp, ctx.ip, "Too many attempts. Please wait 10 minutes.");
      const user = await verifyOtp(ctx.db, input.email, input.code);
      const s = await createSession(ctx.db, user.id);
      ctx.setCookie(sessionCookie(s.token, s.expiresAt));
      return { role: user.role, needsName: !user.name };
    }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await destroySession(ctx.db, ctx.sessionToken);
    ctx.setCookie(clearSessionCookie());
    return { ok: true };
  }),
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2, "Enter your full name").max(80),
        phone: z
          .string()
          .trim()
          .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
          .pipe(z.union([z.literal(""), z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")]))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(users).set({ name: input.name, phone: input.phone || null }).where(eq(users.id, ctx.user.id));
      await forgetSession(ctx.sessionToken);
      return { ok: true };
    }),
});

export const catalogRouter = router({
  list: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        group: z.string().optional(),
        q: z.string().max(80).optional(),
        sort: z.enum(["trending", "price-asc", "price-desc", "new"]).optional(),
        inStock: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => filterProducts(await listStoreProducts(ctx.db), input)),
  product: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const p = await productDetail(ctx.db, input.slug);
    if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    return p;
  }),
  categories: publicProcedure.query(({ ctx }) => storeCategories(ctx.db)),
  /** Box/set groups with products in the store, plus how many single items there are (menus, shop filters). */
  groups: publicProcedure.query(async ({ ctx }) => {
    const all = await listStoreProducts(ctx.db);
    return { groups: liveGroups(all), items: all.filter((p) => p.kind === "single").length };
  }),
  /** A box with its contents for the home page (doesn't count as a product view). */
  spotlight: publicProcedure.input(z.object({ slug: z.string() })).query(({ ctx, input }) => productDetail(ctx.db, input.slug, false)),
  /** Live custom pages (menu + /c/<slug>). */
  festivals: publicProcedure.query(({ ctx }) => liveFestivals(ctx.db)),
  festival: publicProcedure.input(z.object({ slug: z.string().max(80) })).query(async ({ ctx, input }) => {
    const f = await festivalPage(ctx.db, input.slug);
    if (!f) throw new TRPCError({ code: "NOT_FOUND", message: "Festival not found" });
    return f;
  }),
  /** Deals page: products selling below their struck price, plus cart offers that need no code. */
  deals: publicProcedure.query(async ({ ctx }) => {
    const [all, discs] = await Promise.all([listStoreProducts(ctx.db), liveDiscounts(ctx.db)]);
    const products = all
      .filter((p) => p.mrp && p.mrp > p.price && !p.upcoming)
      .sort((a, b) => (b.mrp! - b.price) / b.mrp! - (a.mrp! - a.price) / a.mrp!); // biggest % off first
    const offers = discs
      .filter((d) => d.kind === "auto_cart")
      .map((d) => ({ id: d.id, name: d.name, type: d.type, value: d.value, minSubtotal: d.minSubtotal, maxDiscount: d.maxDiscount, endsAt: d.endsAt }));
    return { products, offers };
  }),
  settings: publicProcedure.query(async ({ ctx }) => {
    const s = await getSettings(ctx.db);
    return s;
  }),
});

export const cartRouter = router({
  quote: publicProcedure
    .input(z.object({ lines: linesSchema, couponCode: z.string().max(40).optional().nullable() }))
    .query(async ({ ctx, input }) => {
      await enforce(LIMITS.quoteIp, ctx.ip);
      // Coupon guessing is limited across all servers.
      if (input.couponCode) await enforce(LIMITS.couponIp, ctx.ip, "Too many coupon tries. Please wait a few minutes.");
      return quoteCart(ctx.db, { ...input, userId: ctx.user?.id });
    }),
});

export const pincodeRouter = router({
  lookup: publicProcedure.input(z.object({ pincode: z.string().regex(/^[1-9]\d{5}$/) })).query(async ({ ctx, input }) => {
    await enforce(LIMITS.pincodeIp, ctx.ip);
    // Pincodes don't change: answers from India Post's lookup are kept in Redis for 30 days.
    const key = nsKey(`pin:${input.pincode}`);
    const hit = (await redisPipeline([["GET", key]]))?.[0]?.result;
    if (typeof hit === "string") {
      try {
        return JSON.parse(hit) as { found: true; city: string; state: string; areas: string[] } | { found: false };
      } catch {
        /* look it up again */
      }
    }
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${input.pincode}`, { signal: AbortSignal.timeout(4000) });
      const data = (await res.json()) as { Status: string; PostOffice: { District: string; State: string; Name: string; DeliveryStatus: string }[] | null }[];
      const po = data[0]?.PostOffice;
      const answer = data[0]?.Status !== "Success" || !po?.length ? { found: false as const } : { found: true as const, city: po[0].District, state: po[0].State, areas: po.map((p) => p.Name).slice(0, 12) };
      await redisPipeline([["SET", key, JSON.stringify(answer), "EX", answer.found ? 30 * 86400 : 86400]]);
      return answer;
    } catch {
      return { found: false as const, offline: true };
    }
  }),
});

export const accountRouter = router({
  addresses: protectedProcedure.query(({ ctx }) =>
    ctx.db.select().from(addresses).where(eq(addresses.userId, ctx.user.id)).orderBy(desc(addresses.isDefault), desc(addresses.createdAt)),
  ),
  saveAddress: protectedProcedure
    .input(addressSchema.extend({ id: z.number().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.isDefault) await ctx.db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, ctx.user.id));
      if (id) {
        const [a] = await ctx.db.update(addresses).set(data).where(and(eq(addresses.id, id), eq(addresses.userId, ctx.user.id))).returning();
        return a;
      }
      const [a] = await ctx.db.insert(addresses).values({ ...data, userId: ctx.user.id }).returning();
      return a;
    }),
  setDefaultAddress: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.transaction(async (tx) => {
      await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, ctx.user.id));
      await tx.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, input.id), eq(addresses.userId, ctx.user.id)));
    });
    return { ok: true };
  }),
  deleteAddress: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(addresses).where(and(eq(addresses.id, input.id), eq(addresses.userId, ctx.user.id)));
    return { ok: true };
  }),
  orders: protectedProcedure.query(async ({ ctx }) => {
    const list = await ctx.db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, ctx.user.id), ne(orders.status, "pending_payment")))
      .orderBy(desc(orders.createdAt));
    const items = list.length ? await ctx.db.select().from(orderItems).where(inArray(orderItems.orderId, list.map((o) => o.id))) : [];
    return list.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
  }),
  order: protectedProcedure.input(z.object({ number: z.string() })).query(async ({ ctx, input }) => {
    const [o] = await ctx.db.select().from(orders).where(and(eq(orders.number, input.number), eq(orders.userId, ctx.user.id))).limit(1);
    if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    const [items, events] = await Promise.all([
      ctx.db.select().from(orderItems).where(eq(orderItems.orderId, o.id)),
      ctx.db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id)).orderBy(desc(orderEvents.createdAt)),
    ]);
    return { ...o, items, events };
  }),
});

/** Order tracking without logging in: order number + the email used at checkout. */
export const trackRouter = router({
  order: publicProcedure
    .input(z.object({ number: z.string().trim().max(20), email: z.string().trim().max(160) }))
    .mutation(async ({ ctx, input }) => {
      await enforce(LIMITS.trackIp, ctx.ip, "Too many lookups. Please wait a few minutes.");
      const number = input.number.toUpperCase().replace(/^#/, "");
      const [o] = await ctx.db.select().from(orders).where(eq(orders.number, number)).limit(1);
      // Same answer for a wrong number or a wrong email, so nobody can probe which orders exist.
      if (!o || o.email.toLowerCase() !== input.email.toLowerCase())
        throw new TRPCError({ code: "NOT_FOUND", message: "We couldn’t find an order with that number and email. Check both and try again." });
      const [items, events] = await Promise.all([
        ctx.db.select({ name: orderItems.name, qty: orderItems.qty }).from(orderItems).where(eq(orderItems.orderId, o.id)),
        ctx.db.select({ status: orderEvents.status, at: orderEvents.createdAt }).from(orderEvents).where(eq(orderEvents.orderId, o.id)).orderBy(desc(orderEvents.createdAt)),
      ]);
      return {
        number: o.number,
        status: o.status,
        placedAt: o.createdAt,
        carrier: o.carrier,
        trackingNumber: o.trackingNumber,
        shippedAt: o.shippedAt,
        items,
        events: events.filter((e) => e.status),
      };
    }),
});

/**
 * Skipping the payment window: in local dev (ALLOW_MOCK_PAYMENTS), or for ADMINS on any server so the owner can
 * test checkout end to end in production. Admins can already mark any order paid in the admin panel, so this
 * grants no new power; shoppers always pay. Such orders get a payment id starting "admin_test_".
 */
const canSkipPayment = (user: { role: string } | null | undefined) => env.mockPayments() || user?.role === "admin";

export const checkoutRouter = router({
  config: publicProcedure.query(({ ctx }) => ({ mock: canSkipPayment(ctx.user), adminTest: !env.mockPayments() && ctx.user?.role === "admin", razorpayKeyId: env.razorpay().keyId, google: googleConfigured() })),
  create: protectedProcedure
    .input(
      z.object({
        lines: linesSchema.min(1, "Your cart is empty"),
        couponCode: z.string().max(40).optional().nullable(),
        address: addressSchema,
        saveAddress: z.boolean().default(true),
        addressId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await enforce(LIMITS.checkoutUser, `u${ctx.user.id}`, "Too many checkout attempts. Please wait a few minutes.");
      await expireStaleOrders(ctx.db).catch(() => {});
      const quote = await quoteCart(ctx.db, { lines: input.lines, couponCode: input.couponCode, userId: ctx.user.id });
      if (!quote.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart is empty." });
      if (quote.problems.length) throw new TRPCError({ code: "BAD_REQUEST", message: quote.problems[0] });

      if (input.saveAddress && !input.addressId) {
        const existing = await ctx.db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, ctx.user.id)).limit(1);
        await ctx.db.insert(addresses).values({ ...input.address, userId: ctx.user.id, isDefault: !existing.length });
      }
      if (!ctx.user.phone || !ctx.user.name) {
        await ctx.db
          .update(users)
          .set({ phone: ctx.user.phone ?? input.address.phone, name: ctx.user.name ?? input.address.name })
          .where(eq(users.id, ctx.user.id));
        await forgetSession(ctx.sessionToken);
      }

      const order = await createPendingOrder(ctx.db, {
        userId: ctx.user.id,
        email: ctx.user.email,
        quote,
        address: input.address,
        couponCode: input.couponCode?.trim().toUpperCase() ?? null,
      });

      if (order.total <= 0) {
        await markOrderPaid(ctx.db, order.id, null, "system");
        return { number: order.number, paid: true as const };
      }
      if (canSkipPayment(ctx.user)) return { number: order.number, mock: true as const, amount: order.total };

      const rzp = await createRazorpayOrder(order.total, order.number, { order_number: order.number });
      await ctx.db.update(orders).set({ razorpayOrderId: rzp.id }).where(eq(orders.id, order.id));
      return {
        number: order.number,
        razorpay: {
          key: env.razorpay().keyId,
          orderId: rzp.id,
          amount: rzp.amount,
          currency: rzp.currency,
          prefill: { name: input.address.name, email: ctx.user.email, contact: input.address.phone },
        },
      };
    }),
  verify: protectedProcedure
    .input(
      z.union([
        z.object({ number: z.string(), razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }),
        z.object({ number: z.string(), mock: z.literal(true) }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const [o] = await ctx.db.select().from(orders).where(and(eq(orders.number, input.number), eq(orders.userId, ctx.user.id))).limit(1);
      if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if ("mock" in input) {
        if (!canSkipPayment(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Payment is required." });
        const r = await markOrderPaid(ctx.db, o.id, (env.mockPayments() ? "mock_" : "admin_test_") + Date.now(), "checkout");
        if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.message });
        return { ok: true };
      }
      if (o.razorpayOrderId !== input.razorpay_order_id || !verifyPaymentSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "We couldn't verify this payment. If money was debited, it will be confirmed automatically within a few minutes." });
      }
      const r = await markOrderPaid(ctx.db, o.id, input.razorpay_payment_id, "checkout");
      if (!r.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Your payment went through, but this order can no longer be completed. We'll refund you; write to us if you don't hear back within a day." });
      }
      return { ok: true };
    }),
});
