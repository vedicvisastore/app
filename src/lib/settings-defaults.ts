/** One message in the scrolling ribbon above the header. href: optional link (a store path like /deals, or https://). */
export type RibbonItem = { text: string; href?: string };

export type StoreSettings = {
  /** paise */
  shippingFee: number;
  /** paise; order subtotal (after discounts) at or above this ships free. 0 = always free. */
  freeShippingThreshold: number;
  /** Old single-line ribbon text ("a · b"); kept for stores saved before `ribbon` existed. */
  announcement: string;
  /** Scrolling ribbon messages, in order. Empty list hides the ribbon. */
  ribbon: RibbonItem[];
  /** Ribbon speed: seconds for one full loop. */
  ribbonSeconds: number;
  /** Estimated India Post delivery window shown on product pages */
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  supportEmail: string;
  supportPhone: string;
  /** The store's Instagram (handle or full profile URL) */
  instagram: string;
  /** The creator's personal Instagram, shown as "meet the creator". Empty hides it. */
  creatorInstagram: string;
  /** YouTube channel URL or @handle */
  youtube: string;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  shippingFee: 7900,
  freeShippingThreshold: 99900,
  announcement: "Free shipping on orders above ₹999 · Shipped across India by India Post",
  ribbon: [{ text: "Free shipping on orders above ₹999" }, { text: "Shipped across India by India Post" }],
  ribbonSeconds: 40,
  deliveryDaysMin: 4,
  deliveryDaysMax: 8,
  supportEmail: "hello@vedicvisa.com",
  supportPhone: "",
  instagram: "https://www.instagram.com/vedicvisastore",
  creatorInstagram: "https://www.instagram.com/vedicvisa",
  youtube: "https://www.youtube.com/@vedicvisa",
};

/** Accepts a handle (@vedicvisa) or a full URL and returns a safe https link, or null. */
export function socialUrl(kind: "instagram" | "youtube", value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // Full links keep their path but lose share-tracking params (?si=, ?igsh=, ?psln=).
  if (/^https:\/\/(www\.)?(instagram\.com|youtube\.com|youtu\.be)\//i.test(v)) return v.split(/[?#]/)[0];
  const handle = v.replace(/^@/, "").replace(/[^\w.-]/g, "");
  if (!handle) return null;
  return kind === "instagram" ? `https://instagram.com/${handle}` : `https://www.youtube.com/@${handle}`;
}

/** Only store paths and https links are allowed in the ribbon. */
export function safeRibbonHref(href: string | undefined) {
  const h = href?.trim();
  if (!h) return undefined;
  if (/^\/(?!\/)/.test(h) || /^https:\/\//i.test(h)) return h;
  return undefined;
}

/** "@handle" for an Instagram or YouTube profile link, for display. */
export function socialHandle(url: string | null) {
  if (!url) return null;
  const seg = url.replace(/^https:\/\/[^/]+\//, "").split("/")[0].replace(/^@/, "");
  return seg ? `@${seg}` : null;
}
