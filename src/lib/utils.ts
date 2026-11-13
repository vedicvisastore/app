export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** paise → "₹1,234" (drops .00) */
export function inr(paise: number) {
  const rupees = paise / 100;
  return (
    "₹" +
    rupees.toLocaleString("en-IN", {
      minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function pctOff(price: number, mrp: number | null | undefined) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Kolkata",
  });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const INDIA_POST_TRACK_URL =
  "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];

export const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

/** "Launching soon", or "Launching 24 Nov" when a launch date is set. */
export function launchLabel(launchAt: Date | string | null | undefined) {
  if (!launchAt) return "Launching soon";
  const d = new Date(launchAt);
  return `Launching ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`;
}

/** Link from the admin panel to a storefront page. On admin.vedicvisa.com a bare "/x" would open the admin's /x, so use the store's full address when known. */
export const storeHref = (path: string) => `${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")}${path}`;
