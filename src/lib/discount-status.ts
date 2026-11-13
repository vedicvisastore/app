/** A discount's lifecycle, derived in one place so the shop, checkout and admin always agree. */
export type DiscountState = "off" | "scheduled" | "live" | "ended" | "used_up";

export function discountState(
  d: { active: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usedCount: number },
  now = new Date(),
): DiscountState {
  if (!d.active) return "off";
  if (d.startsAt && d.startsAt > now) return "scheduled";
  if (d.endsAt && d.endsAt <= now) return "ended";
  if (d.usageLimit != null && d.usedCount >= d.usageLimit) return "used_up";
  return "live";
}
