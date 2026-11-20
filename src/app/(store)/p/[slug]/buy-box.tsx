"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { QtyStepper } from "@/components/cart/cart-drawer";
import { Button } from "@/components/ui";
import { useContent } from "@/components/site/content-context";
import { fmt } from "@/content/defaults";

export function BuyBox({ productId, available, name, upcoming, instagram }: { productId: number; available: number | null; name: string; upcoming?: string | null; instagram?: string | null }) {
  const c = useContent().product;
  const cart = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const soldOut = available === 0;

  if (upcoming)
    return (
      <div className="mt-7 rounded-[var(--radius-card)] bg-gold-soft p-5">
        <p className="font-display text-2xl">{upcoming}</p>
        <p className="mt-1 text-ink-soft">{c.launchBody}</p>
        {instagram && (
          <a href={instagram} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-12 items-center rounded-full bg-gold px-6 font-bold text-shyam">
            {c.launchCta}
          </a>
        )}
      </div>
    );

  if (soldOut)
    return (
      <div className="mt-7 rounded-2xl bg-sky p-4">
        <p className="font-bold">{c.soldOutTitle}</p>
        <p className="text-sm text-ink-soft">{c.soldOutBody}</p>
      </div>
    );

  // One number, one source: once the product is in the cart, the stepper edits the cart itself (so it always matches
  // the drawer and the header count). Before that, it only picks how many "Add to cart" will add.
  const line = cart.lines.find((l) => l.productId === productId);
  const inCart = cart.ready ? (line?.qty ?? 0) : 0;
  const limit = Math.min(20, available ?? 20);

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center gap-3">
        {inCart > 0 ? (
          <>
            <QtyStepper qty={inCart} max={available} onChange={(q) => cart.setQty(productId, Math.min(limit, q))} label={name} />
            <span className="text-sm font-bold text-mor" aria-live="polite">
              {fmt(c.inCart, { qty: inCart })}
            </span>
          </>
        ) : (
          <QtyStepper qty={qty} max={available} onChange={(q) => setQty(Math.min(limit, Math.max(1, q)))} label={name} />
        )}
        {available != null && available <= 5 && <span className="text-sm font-bold text-gold-ink">Only {available} left</span>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {inCart > 0 ? (
          <Button size="lg" onClick={() => cart.setOpen(true)}>
            {c.viewCart}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => {
              cart.add(productId, qty);
              setQty(1);
            }}
          >
            {c.addToCart}
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            // Already in the cart: go as is (adding again doubled the quantity).
            if (inCart === 0) cart.add(productId, qty);
            cart.setOpen(false);
            router.push("/checkout");
          }}
        >
          {c.buyNow}
        </Button>
      </div>
    </div>
  );
}
