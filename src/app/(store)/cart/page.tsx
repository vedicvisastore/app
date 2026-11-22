"use client";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import {
  FreeShippingMeter,
  QtyStepper,
  useCartRows,
  useQuote,
} from "@/components/cart/cart-drawer";
import { CouponField, Totals } from "@/components/cart/summary";
import { ButtonLink, Container, Media, ProductArt } from "@/components/ui";
import { inr } from "@/lib/utils";

export default function CartPage() {
  const cart = useCart();
  const { data: quote, isFetching } = useQuote();
  const { rows, synced } = useCartRows(quote);

  if (cart.ready && cart.lines.length === 0)
    return (
      <Container className="flex flex-col items-center py-28 text-center">
        <h1 className="text-[length:var(--text-display-s)]">
          Your cart is empty
        </h1>
        <p className="mt-3 max-w-sm text-ink-soft">
          Add a Bhakti Box or a few daily essentials and they’ll wait for you
          here.
        </p>
        <ButtonLink href="/shop" className="mt-7" size="lg">
          Start shopping
        </ButtonLink>
      </Container>
    );

  return (
    <Container className="pt-10">
      <h1 className="text-[length:var(--text-display-s)]">Your Cart</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          {quote && (
            <FreeShippingMeter
              toGo={quote.amountToFreeShipping}
              threshold={quote.freeShippingThreshold}
            />
          )}
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {rows.map(({ productId, qty, info: l, lineTotal }) =>
              !l ? (
                <li
                  key={productId}
                  className="flex animate-pulse gap-4 py-5"
                  aria-hidden
                >
                  <div className="h-28 w-24 shrink-0 rounded-xl bg-sky" />
                  <div className="h-4 w-1/3 rounded bg-sky" />
                </li>
              ) : (
                <li key={l.productId} className="flex gap-4 py-5">
                  <Link
                    href={`/p/${l.slug}`}
                    className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-sky"
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
                  <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex-1">
                      <Link
                        href={`/p/${l.slug}`}
                        className="font-bold hover:text-royal"
                      >
                        {l.name}
                      </Link>
                      <p className="text-sm text-ink-soft tabular-nums">
                        {inr(l.unitPrice)}{" "}
                        {l.unitMrp && (
                          <s className="text-ink-mute">{inr(l.unitMrp)}</s>
                        )}
                      </p>
                      {l.available != null && qty > l.available && (
                        <p className="text-sm font-bold text-gulal">
                          {l.available === 0
                            ? "Out of stock"
                            : `Only ${l.available} left`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <QtyStepper
                        qty={qty}
                        max={l.available}
                        onChange={(q) => cart.setQty(l.productId, q)}
                        label={l.name}
                      />
                      <span className="w-20 text-right font-bold tabular-nums">
                        {lineTotal != null ? inr(lineTotal) : "…"}
                      </span>
                      <button
                        onClick={() => cart.remove(l.productId)}
                        className="text-ink-mute hover:text-gulal"
                        aria-label={`Remove ${l.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ),
            )}
          </ul>
        </div>
        <aside className="h-fit space-y-5 rounded-3xl border border-line p-6 lg:sticky lg:top-28">
          <CouponField quote={quote} />
          <Totals quote={quote} loading={isFetching || !synced} />
          {quote?.problems[0] && (
            <p className="text-sm font-bold text-gulal">{quote.problems[0]}</p>
          )}
          <ButtonLink
            href="/checkout"
            size="lg"
            className="w-full"
            aria-disabled={!!quote?.problems.length || !synced}
          >
            Checkout
          </ButtonLink>
        </aside>
      </div>
    </Container>
  );
}
