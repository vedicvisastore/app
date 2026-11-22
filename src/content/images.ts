/**
 * Store pictures the owner can swap in the visual editor (Admin → Store text → Visual editor).
 * Saved as overrides in the site config file, like store text. Product photos live on the products themselves,
 * and the painted banner scenes are not here on purpose: products are positioned on their stone steps.
 */
export const IMAGE_SLOTS = {
  "brand.logo": { label: "Logo", where: "Header, phone menu, banner, page-not-found", value: "/brand/logo.png", hint: "PNG with a see-through background works best, about 900 × 590." },
  "brand.logoRound": { label: "Round logo", where: "Footer", value: "/brand/logo-round.jpg", hint: "Square picture; it is shown in a circle." },
  "home.templeArt": { label: "Home painting", where: "Home page, beside the shloka", value: "/brand/hero-temple.jpg", hint: "Tall picture (4 : 5), shown inside the temple arch." },
  "about.art": { label: "Our story painting", where: "Our story page", value: "/brand/hero-temple.jpg", hint: "Tall picture (4 : 5), shown inside the temple arch." },
  "shop.emptyArt": { label: "No results picture", where: "Shop, when a search finds nothing", value: "/brand/makhan-monkey.webp", hint: "Picture with a see-through background, taller than wide." },
} as const;

export type ImageKey = keyof typeof IMAGE_SLOTS;
export type SiteImages = Record<ImageKey, string>;

export const DEFAULT_IMAGES = Object.fromEntries(Object.entries(IMAGE_SLOTS).map(([k, v]) => [k, v.value])) as SiteImages;
export const isImageKey = (k: string): k is ImageKey => k in IMAGE_SLOTS;

/** Only our own paths and https links (uploads live on R2 / the media domain). */
export const safeImageSrc = (src: string) => (/^\/(?!\/)[\w\-./]+$/.test(src) || /^https:\/\/[^\s"'<>]+$/.test(src) ? src : null);

export function mergeImages(over: Record<string, string> | undefined | null): SiteImages {
  const out = { ...DEFAULT_IMAGES };
  for (const [k, v] of Object.entries(over ?? {})) if (isImageKey(k) && typeof v === "string" && safeImageSrc(v)) out[k] = v;
  return out;
}
