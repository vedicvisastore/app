/** Menu/footer/shop-filter links for what is actually in the store: live box/set groups and single items. */
export type ShopLink = { href: string; label: string; slug: string };

export function shopLinks(
  groups: { name: string; slug: string }[],
  items: number,
  nav: { boxes: string; japa: string; shringar: string; items: string },
): ShopLink[] {
  const known: Record<string, string> = { "bhakti-boxes": nav.boxes, "japa-sets": nav.japa, "shringar-kits": nav.shringar };
  const sets = groups.map((g) => ({ href: `/shop?group=${g.slug}`, label: known[g.slug] ?? g.name, slug: g.slug }));
  const single = items > 0 ? [{ href: "/shop?group=items", label: nav.items, slug: "items" }] : [];
  // Boxes first, then the single items (owner: the store sells items on their own too), then any other sets.
  return [...sets.filter((s) => s.slug === "bhakti-boxes"), ...single, ...sets.filter((s) => s.slug !== "bhakti-boxes")];
}
