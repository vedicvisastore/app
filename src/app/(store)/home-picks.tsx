"use client";
import { ArrowRight, BadgePercent, Flame, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ProductCard } from "@/components/product/cards";
import { useContent } from "@/components/site/content-context";
import { Container } from "@/components/ui";
import type { CardProduct } from "@/server/catalog";
import { cn } from "@/lib/utils";

type Tab = "best" | "offers" | "new";

/**
 * First thing under the hero: what's selling, what's on offer, what's new, as a swipeable product rail,
 * with the store's live offers as small chips above it. Products first, at a glance.
 */
export function HomePicks({ best, offers, fresh, chips }: { best: CardProduct[]; offers: CardProduct[]; fresh: CardProduct[]; chips: { text: string; kind: "offer" | "shipping" | "sale" }[] }) {
  const c = useContent().home;
  const tabs = (
    [
      { key: "best", label: c.picksBest, icon: Flame, list: best },
      { key: "offers", label: c.picksOffers, icon: BadgePercent, list: offers },
      { key: "new", label: c.picksNew, icon: Sparkles, list: fresh },
    ] as const
  ).filter((t) => t.list.length > 0);
  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? "best");
  const rail = useRef<HTMLDivElement>(null);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  if (!current) return null;
  const allHref = tab === "offers" ? "/deals" : tab === "new" ? "/new" : "/shop";

  return (
    <section className="home-picks" aria-labelledby="picks" data-s="home.picks">
      <Container>
        {chips.length > 0 && (
          <ul className="no-scrollbar -mx-[var(--gutter)] mb-6 -mt-1.5 flex gap-2 overflow-x-auto px-[var(--gutter)] py-1.5" aria-label="Offers right now">
            {chips.map((chip) => (
              <li key={chip.text} className="vv-sheen shrink-0 rounded-full">
                <Link
                  href={chip.kind === "shipping" ? "/shop" : "/deals"}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-transform hover:-translate-y-0.5",
                    chip.kind === "offer" && "bg-gulal-soft text-gulal",
                    chip.kind === "sale" && "bg-gold-soft text-gold-ink",
                    chip.kind === "shipping" && "bg-mor-soft text-mor",
                  )}
                >
                  {chip.kind === "shipping" ? <Truck className="size-4" aria-hidden /> : <BadgePercent className="size-4" aria-hidden />}
                  {chip.text}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="picks" className="text-[length:clamp(1.9rem,2.4vw+1rem,3rem)]">
            {c.picksTitle}
          </h2>
          <Link href={allHref} className="inline-flex items-center gap-1.5 text-sm font-bold text-royal">
            {c.picksAll} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="no-scrollbar -mx-[var(--gutter)] mt-3.5 flex gap-2 overflow-x-auto px-[var(--gutter)] py-1.5" role="tablist" aria-label={c.picksTitle}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                rail.current?.scrollTo({ left: 0, behavior: "smooth" });
              }}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors",
                tab === t.key ? "border-shyam bg-shyam text-on-shyam" : "border-line text-ink-soft hover:border-ink hover:text-ink",
              )}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        <div
          ref={rail}
          role="tabpanel"
          className="no-scrollbar -mx-[var(--gutter)] mt-6 flex snap-x snap-mandatory gap-[var(--gap-columns)] overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-2"
        >
          {current.list.map((p, i) => (
            <div key={`${tab}-${p.id}`} className="w-[44vw] shrink-0 snap-start sm:w-[30vw] md:w-[23vw] lg:w-[22%]">
              <ProductCard p={p} priority={i < 2} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
