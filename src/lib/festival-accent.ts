/** Accent → token classes. Full class names so Tailwind keeps them; tokens so admin themes still apply. */
export const ACCENT_BAND: Record<string, string> = {
  gulal: "bg-gulal text-white",
  gold: "bg-gold text-shyam",
  royal: "bg-royal text-white",
  peacock: "bg-peacock text-white",
  mor: "bg-mor text-white",
};
export const ACCENT_DOT: Record<string, string> = { gulal: "bg-gulal", gold: "bg-gold", royal: "bg-royal", peacock: "bg-peacock", mor: "bg-mor" };
export const ACCENT_LABEL: Record<string, string> = { gulal: "Gulal pink", gold: "Bansuri gold", royal: "Royal blue", peacock: "Peacock teal", mor: "Mor green" };

export function festivalDay(d: Date | string | null) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }) : null;
}
