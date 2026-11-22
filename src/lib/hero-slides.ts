/**
 * Home banner slides as the admin sets them up (Admin → Home banner), saved in settings `heroSlides`.
 * An empty list means "automatic": the home page builds slides from the catalogue (see `automaticHeroSlides`).
 */
export type HeroSlideKind = "brand" | "feature" | "trio";

export type HeroSlideConfig = {
  id: string;
  /** brand: logo + words. feature: one product on the long plinth. trio: three products on three plinths. */
  kind: HeroSlideKind;
  /** Small word above the headline (feature and trio). */
  label?: string;
  title: string;
  /** One sentence under the headline (brand and feature). */
  lede?: string;
  /** Main button. */
  action: string;
  href: string;
  /** Optional text link beside the button. */
  secondaryLabel?: string;
  secondaryHref?: string;
  /** feature: first one is used. trio: first three. */
  productIds: number[];
  /** Kept in the list but not shown in the store. */
  hidden?: boolean;
};

export const HERO_MAX_SLIDES = 8;
export const HERO_PRODUCTS: Record<HeroSlideKind, number> = { brand: 0, feature: 1, trio: 3 };
export const HERO_SCENE: Record<HeroSlideKind, string> = {
  brand: "/brand/hero-banner.webp",
  feature: "/brand/hero-banner-single.webp",
  trio: "/brand/hero-banner-trio.webp",
};

type CatalogItem = {
  id: number;
  kind: "single" | "bundle";
  bundleGroup: string | null;
  image: string | null;
  featured: boolean;
  pinned: boolean;
  score: number;
  upcoming: boolean;
  available: number | null;
};

type HomeCopy = {
  heroEverydayTitle: string;
  heroEverydayLede: string;
  heroEverydayAction: string;
  storyTile: string;
  heroTitle: string;
  heroLede: string;
  heroPrimary: string;
  heroItemsLabel: string;
  heroItemsTitle: string;
  heroItemsAction: string;
  heroSetsLabel: string;
  heroSetsTitle: string;
  heroSetsAction: string;
};

/** What the banner shows when the admin hasn't set it up: the brand, then a balanced turn each for the signature box,
 * three single items and three japa/shringar sets (a slide is skipped when there isn't enough to fill it). */
export function automaticHeroSlides(all: CatalogItem[], c: HomeCopy, boxesLabel: string): HeroSlideConfig[] {
  const photoFirst = <T extends CatalogItem>(list: T[]) =>
    [...list].sort((a, b) => Number(!!b.image) - Number(!!a.image) || Number(b.pinned) - Number(a.pinned) || b.score - a.score);
  const boxes = all.filter((p) => p.bundleGroup === "Bhakti Boxes");
  const signature = photoFirst(boxes.filter((b) => b.featured))[0] ?? photoFirst(boxes)[0];
  const buyable = (p: CatalogItem) => !p.upcoming && p.available !== 0;
  const items = photoFirst(all.filter((p) => p.kind === "single" && buyable(p))).slice(0, 3);
  const japa = photoFirst(all.filter((p) => p.bundleGroup === "Japa Sets" && buyable(p)));
  const shringar = photoFirst(all.filter((p) => p.bundleGroup === "Shringar Kits" && buyable(p)));
  // One of each first, then whichever has more.
  const sets = [japa[0], shringar[0], japa[1], shringar[1], japa[2], shringar[2]].filter(Boolean).slice(0, 3);
  return [
    { id: "brand", kind: "brand", title: c.heroEverydayTitle, lede: c.heroEverydayLede, action: c.heroEverydayAction, href: "/shop", secondaryLabel: c.storyTile, secondaryHref: "/about", productIds: [] },
    ...(signature ? [{ id: "box", kind: "feature" as const, label: boxesLabel, title: c.heroTitle, lede: c.heroLede, action: c.heroPrimary, href: "/shop?group=bhakti-boxes", productIds: [signature.id] }] : []),
    ...(items.length === 3 ? [{ id: "items", kind: "trio" as const, label: c.heroItemsLabel, title: c.heroItemsTitle, action: c.heroItemsAction, href: "/shop?group=items", productIds: items.map((p) => p.id) }] : []),
    ...(sets.length === 3 ? [{ id: "sets", kind: "trio" as const, label: c.heroSetsLabel, title: c.heroSetsTitle, action: c.heroSetsAction, href: japa.length ? "/shop?group=japa-sets" : "/shop?group=shringar-kits", productIds: sets.map((p) => p.id) }] : []),
  ];
}
