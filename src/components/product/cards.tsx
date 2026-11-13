import Link from "next/link";
import type { CardProduct } from "@/server/catalog";
import { inr, launchLabel } from "@/lib/utils";
import { Badge, Media, Price, ProductArt } from "../ui";
import { QuickAdd } from "./quick-add";

function StockNote({ available }: { available: number | null }) {
  if (available === 0) return <Badge tone="ink">Sold out</Badge>;
  if (available != null && available <= 5) return <Badge tone="haldi">Only {available} left</Badge>;
  return null;
}

export function ProductCard({ p, priority }: { p: CardProduct; priority?: boolean }) {
  return (
    <article className="vv-reveal group relative flex flex-col">
      <Link href={`/p/${p.slug}`} aria-label={p.name} className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-paper-2">
        {p.image ? (
          <Media src={p.image} alt={p.name} priority={priority} className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]" />
        ) : (
          <ProductArt name={p.name} seed={p.id} />
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {p.upcoming ? (
            <Badge tone="haldi">{launchLabel(p.launchAt)}</Badge>
          ) : (
            <>
              {p.saleLabel && <Badge tone="gulal">{p.saleLabel}</Badge>}
              {p.trending && !p.saleLabel && <Badge tone="haldi">Trending</Badge>}
              <StockNote available={p.available} />
            </>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        <p className="text-sm text-ink-soft">{p.kind === "bundle" ? p.bundleGroup : p.categoryName}</p>
        <h3 className="mt-1 font-sans text-[1.0625rem] leading-snug font-bold">
          <Link href={`/p/${p.slug}`} className="hover:text-ink">
            {p.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price price={p.price} mrp={p.mrp} size="sm" />
          {p.upcoming ? <span className="text-sm font-bold text-gold-ink">Soon</span> : <QuickAdd productId={p.id} disabled={p.available === 0} name={p.name} />}
        </div>
      </div>
    </article>
  );
}

/** Bhakti Boxes use the same rectangular image area as the catalogue. */
export function BoxCard({ p, priority }: { p: CardProduct; priority?: boolean }) {
  const saving = p.worth - p.price;
  return (
    <article className="group flex flex-col">
      <Link href={`/p/${p.slug}`} aria-label={p.name} className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-paper-2">
          {p.image ? <Media src={p.image} alt={p.name} priority={priority} className="h-full w-full object-cover" /> : <ProductArt name={p.name} seed={p.id} />}
          {p.upcoming && <Badge tone="haldi" className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">{launchLabel(p.launchAt)}</Badge>}
      </Link>
      <div className="pt-4">
        <h3 className="font-display text-[length:var(--text-title)]">
          <Link href={`/p/${p.slug}`} className="hover:text-ink">
            {p.name.replace(/ Bhakti Box$/, "")}
          </Link>
        </h3>
        <div className="mt-3">
          <Price price={p.price} mrp={p.mrp} size="sm" />
        </div>
        {saving > 0 && <p className="mt-1 text-sm text-mor">Worth {inr(p.worth)} separately</p>}
      </div>
    </article>
  );
}
