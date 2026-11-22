import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product/cards";
import { ButtonLink, Container } from "@/components/ui";
import { cn } from "@/lib/utils";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";
import { shopLinks } from "@/lib/shop-links";
import { SortSelect } from "./sort-select";
import { Rangoli, Toran } from "@/components/site/ornaments";
import Image from "next/image";

export const metadata: Metadata = { title: "Shop" };


type SP = Promise<{ category?: string; group?: string; q?: string; sort?: string; stock?: string }>;

export default async function Shop({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sort = (["trending", "price-asc", "price-desc", "new"] as const).find((s) => s === sp.sort) ?? "trending";
  const trpc = await api();
  const [list, categories, { content }, live] = await Promise.all([
    trpc.catalog.list({ category: sp.category, group: sp.group, q: sp.q?.slice(0, 80), sort, inStock: sp.stock === "1" }),
    trpc.catalog.categories(),
    getSite(),
    trpc.catalog.groups(),
  ]);
  const GROUPS = shopLinks(live.groups, live.items, content.nav);
  const c = content.shop;
  const blurbs: Record<string, string> = { "bhakti-boxes": c.boxesBlurb, "japa-sets": c.japaBlurb, "shringar-kits": c.shringarBlurb, items: c.itemsBlurb };
  const group = GROUPS.find((g) => g.slug === sp.group);
  const category = categories.find((c) => c.slug === sp.category);
  const title = sp.q ? `Results for “${sp.q}”` : group?.label ?? category?.name ?? c.allTitle;
  const blurb = sp.q ? `${list.length} ${list.length === 1 ? "product" : "products"} found` : (group && blurbs[group.slug]) ?? category?.description ?? c.allBlurb;

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { category: sp.category, group: sp.group, q: sp.q, sort: sp.sort, stock: sp.stock, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const pill = (active: boolean) =>
    cn(
      "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors duration-[var(--dur-short)] border",
      active ? "border-shyam bg-shyam text-on-shyam" : "border-line text-ink-soft hover:border-ink hover:text-ink",
    );

  return (
    <>
      <div className="on-dark relative overflow-hidden" data-tint="royal">
        <Toran id="toran-shop" variant="bells" className="absolute inset-x-0 top-0" />
        <Rangoli spin className="absolute -top-28 -right-28 size-72 text-gold opacity-[0.12] sm:size-96" />
        <Container className="relative grid items-end gap-6 pt-20 pb-16 lg:grid-cols-12 lg:pt-24 lg:pb-20">
          <div className="lg:col-span-7">
            <h1 className="vv-rise text-[length:var(--text-display-s)] text-on-shyam">{title}</h1>
          </div>
          <p className="lead text-on-shyam-2 lg:col-span-4 lg:col-start-9">{blurb}</p>
        </Container>
      </div>

      <Container>
        <div className="no-scrollbar -mx-[var(--gutter)] mt-8 flex gap-2 overflow-x-auto px-[var(--gutter)] py-2">
          <Link href={href({ group: undefined, category: undefined })} className={pill(!sp.group && !sp.category)}>
            {c.everything}
          </Link>
          {GROUPS.map((g) => (
            <Link key={g.slug} href={href({ group: g.slug, category: undefined })} className={pill(sp.group === g.slug)}>
              {g.label}
            </Link>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />
          {categories
            .filter((c) => c.slug !== "bhakti-boxes-kits")
            .map((c) => (
              <Link key={c.id} href={href({ category: c.slug, group: undefined })} className={pill(sp.category === c.slug)}>
                {c.name}
              </Link>
            ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm text-ink-soft">
            {list.length} {list.length === 1 ? "product" : "products"}
          </p>
          <div className="flex items-center gap-4">
            <Link href={href({ stock: sp.stock === "1" ? undefined : "1" })} className="flex items-center gap-2 text-sm text-ink-soft" role="switch" aria-checked={sp.stock === "1"}>
              <span className={cn("relative h-5 w-9 rounded-full transition-colors", sp.stock === "1" ? "bg-mor" : "bg-line-strong")}>
                <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-[var(--dur-short)]", sp.stock === "1" && "translate-x-4")} />
              </span>
              {c.inStockOnly}
            </Link>
            <SortSelect value={sort} />
          </div>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center sm:py-20">
            {/* Little makhan-pot monkey (owner's artwork, background cut out) */}
            <Image src="/brand/makhan-monkey.webp" alt="" width={520} height={789} className="vv-rise mb-6 h-auto w-36 sm:w-44" />
            <p className="font-display text-3xl">{c.emptyTitle}</p>
            <p className="mt-2 max-w-sm text-ink-soft">{c.emptyBody}</p>
            <ButtonLink href="/shop" className="mt-6">
              {c.emptyCta}
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-14 md:grid-cols-3 lg:grid-cols-4">
            {list.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
