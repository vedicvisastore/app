export type StoreSettings = {
  /** paise */
  shippingFee: number;
  /** paise; order subtotal (after discounts) at or above this ships free. 0 = always free. */
  freeShippingThreshold: number;
  announcement: string;
  /** Estimated India Post delivery window shown on product pages */
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  supportEmail: string;
  supportPhone: string;
  /** Instagram handle or full profile URL */
  instagram: string;
  /** YouTube channel URL or @handle */
  youtube: string;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  shippingFee: 7900,
  freeShippingThreshold: 99900,
  announcement: "Free shipping on orders above ₹999 · Shipped across India by India Post",
  deliveryDaysMin: 4,
  deliveryDaysMax: 8,
  supportEmail: "hello@vedicvisa.com",
  supportPhone: "",
  instagram: "https://www.instagram.com/vedicvisa",
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
