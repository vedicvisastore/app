/** A festival collection's lifecycle, derived in one place so the store menu, pages and admin agree. */
export type FestivalState = "off" | "scheduled" | "live" | "ended";

export function festivalState(f: { active: boolean; showFrom: Date | string | null; showUntil: Date | string | null }, now = new Date()): FestivalState {
  if (!f.active) return "off";
  if (f.showFrom && new Date(f.showFrom) > now) return "scheduled";
  if (f.showUntil && new Date(f.showUntil) <= now) return "ended";
  return "live";
}

export const FESTIVAL_STATE_LABEL: Record<FestivalState, string> = {
  off: "Hidden",
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
};
