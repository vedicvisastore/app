import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { discounts, discountUsages, products, type Discount, type DiscountLine } from "@/db/schema";
import { inr } from "@/lib/utils";
import { availability, discountApplies, effectivePrice, isDiscountLive, isUpcoming, liveDiscounts } from "./catalog";
import { getSettings } from "./settings";

export type CartLineInput = { productId: number; qty: number };

export type QuoteLine = {
  productId: number;
  name: string;
  slug: string;
  sku: string;
  image: string | null;
  kind: "single" | "bundle";
  qty: number;
  unitPrice: number;
  unitMrp: number | null;
  lineTotal: number;
  available: number | null;
  categoryId: number | null;
};

export type Quote = {
  lines: QuoteLine[];
  /** Product ids that no longer exist or aren't for sale */
  removed: number[];
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  discountLines: DiscountLine[];
  discountTotal: number;
  shippingFee: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  total: number;
  coupon: { code: string; applied: boolean; message: string } | null;
  problems: string[];
};

function amountFor(d: Discount, lines: QuoteLine[], subtotal: number) {
  const eligible = lines
    .filter((l) => discountApplies(d, { id: l.productId, categoryId: l.categoryId }))
    .reduce((s, l) => s + l.lineTotal, 0);
  if (!eligible) return 0;
  let amt = 0;
  if (d.type === "percent") amt = Math.round((eligible * d.value) / 100);
  else if (d.type === "flat") amt = Math.min(d.value, eligible);
  if (d.maxDiscount != null) amt = Math.min(amt, d.maxDiscount);
  return Math.min(amt, subtotal);
}

export async function quoteCart(
  db: DB,
  input: { lines: CartLineInput[]; couponCode?: string | null; userId?: number | null },
): Promise<Quote> {
  const settings = await getSettings(db);
  const merged = new Map<number, number>();
  for (const l of input.lines) if (l.qty > 0) merged.set(l.productId, Math.min(20, (merged.get(l.productId) ?? 0) + Math.floor(l.qty)));
  const ids = [...merged.keys()];

  const rows = ids.length
    ? await db.select().from(products).where(and(inArray(products.id, ids), eq(products.visibility, "public")))
    : [];
  const discs = await liveDiscounts(db);
  const sales = discs.filter((d) => d.kind === "sale");
  const avail = await availability(db, rows);
  const problems: string[] = [];

  const lines: QuoteLine[] = rows.map((p) => {
    const ep = effectivePrice(p, sales);
    const qty = merged.get(p.id)!;
    const available = avail.get(p.id) ?? null;
    if (isUpcoming(p)) problems.push(`${p.name} hasn’t launched yet. Remove it to continue.`);
    else if (available === 0) problems.push(`${p.name} is out of stock. Remove it to continue.`);
    else if (available != null && qty > available) problems.push(`Only ${available} of ${p.name} left. Lower the quantity to continue.`);
    return {
      productId: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      image: p.images[0] ?? null,
      kind: p.kind,
      qty,
      unitPrice: ep.price,
      unitMrp: ep.mrp,
      lineTotal: ep.price * qty,
      available,
      categoryId: p.categoryId,
    };
  });
  const removed = ids.filter((id) => !rows.some((r) => r.id === id));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const mrpTotal = lines.reduce((s, l) => s + (l.unitMrp ?? l.unitPrice) * l.qty, 0);

  const discountLines: DiscountLine[] = [];
  let freeShip = false;

  // Best automatic cart discount
  let bestAuto: { d: Discount; amt: number } | null = null;
  for (const d of discs) {
    if (d.kind !== "auto_cart" || subtotal < d.minSubtotal) continue;
    if (d.type === "free_shipping") {
      freeShip = true;
      continue;
    }
    const amt = amountFor(d, lines, subtotal);
    if (amt > 0 && (!bestAuto || amt > bestAuto.amt)) bestAuto = { d, amt };
  }
  if (bestAuto) discountLines.push({ id: bestAuto.d.id, label: bestAuto.d.name, amount: bestAuto.amt });

  // Coupon
  let coupon: Quote["coupon"] = null;
  const code = input.couponCode?.trim().toUpperCase();
  if (code) {
    const [d] = await db.select().from(discounts).where(and(eq(discounts.kind, "coupon"), sql`upper(${discounts.code}) = ${code}`)).limit(1);
    let message = "";
    if (!d || !isDiscountLive(d)) message = "This code isn't valid or has expired.";
    else if (subtotal < d.minSubtotal) message = `Add ${inr(d.minSubtotal - subtotal)} more to use this code.`;
    else if (d.perUserLimit != null && input.userId) {
      const [{ n }] = await db
        .select({ n: count() })
        .from(discountUsages)
        .where(and(eq(discountUsages.discountId, d.id), eq(discountUsages.userId, input.userId)));
      if (n >= d.perUserLimit) message = "You've already used this code.";
    }
    if (!message && d) {
      if (d.type === "free_shipping") {
        freeShip = true;
        discountLines.push({ id: d.id, label: `${d.code}: free shipping`, amount: 0, code: d.code });
        message = "Free shipping applied.";
      } else {
        const amt = amountFor(d, lines, subtotal);
        if (amt <= 0) message = "This code doesn't apply to the items in your cart.";
        else {
          discountLines.push({ id: d.id, label: d.code ?? d.name, amount: amt, code: d.code });
          message = `You saved ${inr(amt)}.`;
        }
      }
    }
    coupon = { code, applied: discountLines.some((l) => l.code?.toUpperCase() === code), message };
  }

  const discountTotal = Math.min(subtotal, discountLines.reduce((s, l) => s + l.amount, 0));
  const after = subtotal - discountTotal;
  const threshold = settings.freeShippingThreshold;
  const qualifies = threshold <= 0 || after >= threshold;
  const shippingFee = !lines.length || freeShip || qualifies ? 0 : settings.shippingFee;

  return {
    lines,
    removed,
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
    mrpTotal,
    subtotal,
    discountLines,
    discountTotal,
    shippingFee,
    freeShippingThreshold: threshold,
    amountToFreeShipping: freeShip || qualifies ? 0 : threshold - after,
    total: after + shippingFee,
    coupon,
    problems,
  };
}
