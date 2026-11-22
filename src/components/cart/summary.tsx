"use client";
import { Tag, X } from "lucide-react";
import { useState } from "react";
import type { Quote } from "@/server/pricing";
import { inr } from "@/lib/utils";
import { Spinner } from "../ui";
import { useCart } from "./cart-context";

export function CouponField({ quote }: { quote: Quote | undefined }) {
  const cart = useCart();
  const [code, setCode] = useState("");
  const applied = quote?.coupon?.applied;

  if (cart.coupon && quote?.coupon)
    return (
      <div className={applied ? "rounded-xl bg-mor-soft px-3 py-2.5" : "rounded-xl bg-gulal-soft px-3 py-2.5"}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold">
            <Tag className="size-4" aria-hidden /> {quote.coupon.code}
          </span>
          <button type="button" onClick={() => cart.setCoupon(null)} className="text-ink-soft hover:text-gulal" aria-label="Remove coupon">
            <X className="size-4" />
          </button>
        </div>
        <p className={applied ? "mt-0.5 text-sm text-mor" : "mt-0.5 text-sm text-gulal"}>{quote.coupon.message}</p>
      </div>
    );

  const apply = () => code.trim() && cart.setCoupon(code.trim().toUpperCase());
  // Not a <form>: this field also sits inside the checkout form.
  return (
    <div className="flex gap-2">
      <label htmlFor="coupon" className="sr-only">
        Coupon code
      </label>
      <input
        id="coupon"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }} placeholder="Coupon code" className="field !rounded-full uppercase" autoComplete="off" />
      <button type="button" onClick={apply} className="shrink-0 rounded-full border-[1.5px] border-ink/15 px-5 font-bold hover:border-royal hover:text-royal disabled:opacity-40" disabled={!code.trim()}>
        Apply
      </button>
    </div>
  );
}

export function Totals({ quote, loading }: { quote: Quote | undefined; loading?: boolean }) {
  if (!quote) return <div className="flex justify-center py-6"><Spinner className="text-gulal" /></div>;
  const mrpSaving = quote.mrpTotal - quote.subtotal;
  return (
    <dl className="space-y-2.5 text-[0.95rem]">
      <div className="flex justify-between">
        <dt className="text-ink-soft">Items ({quote.itemCount})</dt>
        <dd className="tabular-nums">{inr(quote.mrpTotal)}</dd>
      </div>
      {mrpSaving > 0 && (
        <div className="flex justify-between text-mor">
          <dt>Discount on MRP</dt>
          <dd className="tabular-nums">−{inr(mrpSaving)}</dd>
        </div>
      )}
      {quote.discountLines.map((d) => (
        <div key={d.id} className="flex justify-between text-mor">
          <dt>{d.label}</dt>
          <dd className="tabular-nums">{d.amount ? `−${inr(d.amount)}` : "Applied"}</dd>
        </div>
      ))}
      <div className="flex justify-between">
        <dt className="text-ink-soft">Shipping (India Post)</dt>
        <dd className="tabular-nums">{quote.shippingFee ? inr(quote.shippingFee) : <span className="font-bold text-mor">Free</span>}</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <dt className="font-bold">Total</dt>
        <dd className="flex items-center gap-2 text-2xl font-bold tabular-nums">
          {loading && <Spinner className="text-gulal" />}
          {inr(quote.total)}
        </dd>
      </div>
      {quote.mrpTotal - quote.total + quote.shippingFee > 0 && (
        <p className="rounded-lg bg-mor-soft px-3 py-2 text-center text-sm font-bold text-mor">
          You save {inr(quote.mrpTotal - quote.subtotal + quote.discountTotal)} on this order
        </p>
      )}
    </dl>
  );
}
