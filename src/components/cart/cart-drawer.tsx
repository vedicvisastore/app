"use client";
import { useQuery } from "@tanstack/react-query";
import { PeacockFeather, Toran } from "@/components/site/ornaments";
import { Minus, Plus, Trash2, Truck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useContent } from "@/components/site/content-context";
import { cn, inr } from "@/lib/utils";
import { ButtonLink, Media, ProductArt, Spinner } from "../ui";
import { useCart } from "./cart-context";

/** Waits until the value stops changing for `ms`, so quick + + + taps make one price request, not five. */
function useSettled<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useQuote() {
  const trpc = useTRPC();
  const cart = useCart();
  const lines = useSettled(cart.lines, 250);
  return useQuery({
    ...trpc.cart.quote.queryOptions({ lines, couponCode: cart.coupon }),
    enabled: cart.ready,
    placeholderData: (prev) => prev,
  });
}

type Quote = NonNullable<ReturnType<typeof useQuote>["data"]>;
type QuoteLine = Quote["lines"][number];
export type CartRow = {
  productId: number;
  qty: number;
  info: QuoteLine | undefined;
  lineTotal: number | null;
};

/**
 * The cart as the shopper sees it: quantities come straight from the cart (instant), names, photos and prices
 * from the last server quote. While a new quote is on its way, totals are estimated from the known unit price.
 */
export function useCartRows(quote: Quote | undefined) {
  const cart = useCart();
  const byId = new Map((quote?.lines ?? []).map((l) => [l.productId, l]));
  const rows: CartRow[] = cart.lines.map((l) => {
    const info = byId.get(l.productId);
    return {
      productId: l.productId,
      qty: l.qty,
      info,
      lineTotal: info
        ? info.qty === l.qty
          ? info.lineTotal
          : info.unitPrice * l.qty
        : null,
    };
  });
  const synced =
    !!quote &&
    rows.every((r) => r.info && r.info.qty === r.qty) &&
    quote.lines.length === rows.length;
  return { rows, synced };
}

function RowSkeleton() {
  return (
    <li className="flex animate-pulse gap-3 py-4" aria-hidden>
      <div className="h-24 w-20 shrink-0 rounded-xl bg-sky" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-4 w-2/3 rounded bg-sky" />
        <div className="h-3 w-1/3 rounded bg-sky" />
      </div>
    </li>
  );
}

export function FreeShippingMeter({
  toGo,
  threshold,
}: {
  toGo: number;
  threshold: number;
}) {
  if (threshold <= 0) return null;
  const pct = Math.min(100, Math.round(((threshold - toGo) / threshold) * 100));
  return (
    <div className="rounded-2xl bg-sky px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-ink">
        <Truck className="size-4 text-yamuna" aria-hidden />
        {toGo > 0 ? (
          <span>
            Add <b>{inr(toGo)}</b> more for free shipping
          </span>
        ) : (
          <span>
            <b>Free Shipping</b> unlocked
          </span>
        )}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-deep"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full origin-left rounded-full bg-mor transition-transform duration-[var(--dur-long)] ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
}

export function QtyStepper({
  qty,
  max,
  onChange,
  label,
}: {
  qty: number;
  max?: number | null;
  onChange: (q: number) => void;
  label: string;
}) {
  const limit = Math.min(20, max ?? 20);
  return (
    <div className="inline-flex h-9 items-center rounded-full border border-line-strong">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full text-ink-soft hover:text-royal"
        onClick={() => onChange(qty - 1)}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <span
        className="w-6 text-center text-sm font-bold tabular-nums"
        aria-live="polite"
      >
        {qty}
      </span>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full text-ink-soft hover:text-royal disabled:opacity-30"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= limit}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function CartDrawer() {
  const copy = useContent().cart;
  const cart = useCart();
  const { data: quote } = useQuote();
  const { rows, synced } = useCartRows(quote);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cart.open) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && cart.setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cart.open, cart]);

  // Drop items that are no longer sold
  useEffect(() => {
    quote?.removed.forEach((id) => cart.remove(id));
  }, [quote?.removed, cart]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[400] overflow-hidden",
        !cart.open && "pointer-events-none invisible",
      )}
      aria-hidden={!cart.open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-ink/40 transition-opacity duration-[var(--dur-long)]",
          cart.open ? "opacity-100" : "opacity-0",
        )}
        onClick={() => cart.setOpen(false)}
      />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={cn(
          "absolute top-0 right-0 flex h-full w-full max-w-[440px] flex-col bg-paper shadow-float outline-none transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
          cart.open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <Toran id="toran-cart" className="h-6 shrink-0" />
        <div className="flex items-center justify-between border-b border-line px-5 pt-1 pb-4">
          <h2 className="font-display text-2xl">
            Your cart{" "}
            {cart.count > 0 && (
              <span className="font-sans text-base text-ink-mute">
                ({cart.count})
              </span>
            )}
          </h2>
          <button
            className="grid size-10 place-items-center rounded-full hover:bg-sky"
            onClick={() => cart.setOpen(false)}
            aria-label="Close cart"
          >
            <X className="size-5" />
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="arch grid h-32 w-24 place-items-end justify-center bg-sky pb-2">
              <PeacockFeather className="h-24 w-auto" />
            </div>
            <p className="font-display text-2xl">{copy.emptyTitle}</p>
            <p className="text-ink-soft">{copy.emptyBody}</p>
            <ButtonLink
              href="/shop?group=bhakti-boxes"
              onClick={() => cart.setOpen(false)}
            >
              {copy.emptyCta}
            </ButtonLink>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {quote && (
                <FreeShippingMeter
                  toGo={quote.amountToFreeShipping}
                  threshold={quote.freeShippingThreshold}
                />
              )}
              <ul className="divide-y divide-line">
                {rows.map(({ productId, qty, info: l, lineTotal }) =>
                  !l ? (
                    <RowSkeleton key={productId} />
                  ) : (
                    <li key={l.productId} className="flex gap-3 py-4">
                      <Link
                        href={`/p/${l.slug}`}
                        onClick={() => cart.setOpen(false)}
                        className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-sky"
                      >
                        {l.image ? (
                          <Media
                            src={l.image}
                            alt={l.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ProductArt name={l.name} seed={l.productId} />
                        )}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/p/${l.slug}`}
                            onClick={() => cart.setOpen(false)}
                            className="font-bold leading-snug hover:text-royal"
                          >
                            {l.name}
                          </Link>
                          <button
                            onClick={() => cart.remove(l.productId)}
                            className="text-ink-mute hover:text-gulal"
                            aria-label={`Remove ${l.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <p className="text-sm text-ink-soft tabular-nums">
                          {inr(l.unitPrice)}
                          {l.unitMrp && (
                            <s className="ml-1.5 text-ink-mute">
                              {inr(l.unitMrp)}
                            </s>
                          )}
                        </p>
                        {l.available === 0 && (
                          <p className="text-sm font-bold text-gulal">
                            Out of stock
                          </p>
                        )}
                        {l.available != null &&
                          l.available > 0 &&
                          qty > l.available && (
                            <p className="text-sm font-bold text-gulal">
                              Only {l.available} left
                            </p>
                          )}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <QtyStepper
                            qty={qty}
                            max={l.available}
                            onChange={(q) => cart.setQty(l.productId, q)}
                            label={l.name}
                          />
                          <span className="font-bold tabular-nums">
                            {lineTotal != null ? inr(lineTotal) : "…"}
                          </span>
                        </div>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="space-y-3 border-t border-line bg-paper px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {quote && synced && quote.discountTotal > 0 && (
                <p className="flex justify-between text-sm text-mor">
                  <span>Offers Applied</span>
                  <span className="tabular-nums">
                    −{inr(quote.discountTotal)}
                  </span>
                </p>
              )}
              <p className="flex items-baseline justify-between">
                <span className="text-ink-soft">Subtotal</span>
                <span className="flex items-center gap-2 text-xl font-bold tabular-nums">
                  {!synced && <Spinner className="text-gulal" />}
                  {quote && synced ? (
                    inr(quote.subtotal - quote.discountTotal)
                  ) : quote ? (
                    <span className="text-ink-mute">
                      {inr(rows.reduce((s, r) => s + (r.lineTotal ?? 0), 0))}
                    </span>
                  ) : (
                    "…"
                  )}
                </span>
              </p>
              <ButtonLink
                href="/checkout"
                size="lg"
                className="w-full"
                aria-disabled={!synced}
                onClick={(e) =>
                  synced ? cart.setOpen(false) : e.preventDefault()
                }
              >
                {copy.checkout}
              </ButtonLink>
              <Link
                href="/cart"
                onClick={() => cart.setOpen(false)}
                className="block text-center text-sm font-bold text-ink-soft hover:text-royal"
              >
                View cart and apply a coupon
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
