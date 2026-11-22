/**
 * Forgiving product search: typos ("tilk"), half words ("kanth"), Hindi spelling variants ("maala", "tulasi",
 * "jaap") and word order all still find the product. Pure and cheap: runs over the cached catalogue in memory.
 */

const STOP = new Set(["a", "an", "and", "the", "for", "of", "with", "in", "set", "sets", "kit", "kits", "ka", "ki", "ke"]);

/** Lowercase, no accents/punctuation, and the usual romanised-Hindi spelling differences folded together. */
export function normalise(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/w/g, "v")
    .replace(/ph/g, "f")
    .replace(/sh/g, "s")
    .replace(/([a-z])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words shoppers type for things the catalogue names differently (already normalised). */
const SYNONYMS: Record<string, string[]> = {
  perfume: ["itra"], atar: ["itra"], atr: ["itra"], itar: ["itra"], scent: ["itra"], fragrance: ["itra"],
  mor: ["peacock"], pankh: ["feather"], morpankh: ["peacock", "feather"], morpank: ["peacock", "feather"],
  tika: ["tilak"], tilaka: ["tilak"], gopichandan: ["gopi", "chandan"], sandal: ["chandan"], sandalwood: ["chandan"],
  gita: ["gita"], gitaji: ["gita"], bhagavad: ["bhagvat"], bhagavat: ["bhagvat"],
  bag: ["bag"], gomukhi: ["bag"], jholi: ["bag"], beads: ["mala"], rosary: ["mala"], necklace: ["kanthi"],
  clicker: ["counter"], tally: ["counter"], gift: ["box"], hamper: ["box"],
};

const tokens = (s: string) => normalise(s).split(" ").filter((t) => t && !STOP.has(t));

/** Edit distance with an early exit once it exceeds `max`. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** How well one typed word matches one word of the product (0 = not at all). */
function wordScore(q: string, w: string) {
  if (q === w) return 1;
  if (w.startsWith(q) && q.length >= 2) return 0.9; // "kanth" → kanthi
  if (q.startsWith(w) && w.length >= 3) return 0.8; // "malas" → mala
  // Vowel-only differences ("tulasi" / "tulsi", "jap" / "japa")
  const bare = (x: string) => x.replace(/[aeiou]/g, "");
  if (q.length >= 3 && bare(q) && bare(q) === bare(w)) return 0.75;
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (max && distance(q, w, max) <= max) return 0.6; // typos
  if (max && w.length > q.length && distance(q, w.slice(0, q.length), max) <= max) return 0.5; // typo in a half word
  return 0;
}

export type Searchable = { name: string; tagline?: string | null; categoryName?: string | null; bundleGroup?: string | null };

/**
 * Score a product for a query: 0 = no match. Name words count most. Every typed word must match something,
 * except that one word may miss when three or more were typed.
 */
export function searchScore(query: string, p: Searchable) {
  const q = tokens(query);
  if (!q.length) return 1;
  const fields: [string[], number][] = [
    [tokens(p.name), 1],
    [tokens(`${p.categoryName ?? ""} ${p.bundleGroup ?? ""}`), 0.8],
    [tokens(p.tagline ?? ""), 0.6],
  ];
  const whole = normalise(`${p.name} ${p.categoryName ?? ""} ${p.bundleGroup ?? ""} ${p.tagline ?? ""}`);
  let total = 0;
  let misses = 0;
  for (const t of q) {
    let best = 0;
    for (const alt of [t, ...(SYNONYMS[t] ?? [])])
      for (const [words, weight] of fields) for (const w of words) best = Math.max(best, wordScore(alt, w) * weight * (alt === t ? 1 : 0.9));
    if (!best && t.length >= 3 && whole.includes(t)) best = 0.5; // inside a longer word
    if (!best) misses++;
    total += best;
  }
  if (misses > (q.length >= 3 ? 1 : 0)) return 0;
  // Bonus when the whole phrase appears as typed.
  if (q.length > 1 && normalise(p.name).includes(q.join(" "))) total += 0.5;
  return total / q.length;
}

/** Products ranked by how well they match. Never empty when anything at all is close. */
export function searchProducts<T extends Searchable>(query: string, list: T[]): T[] {
  const scored = list.map((p) => ({ p, s: searchScore(query, p) }));
  const hits = scored.filter((x) => x.s > 0);
  if (hits.length) return hits.sort((a, b) => b.s - a.s).map((x) => x.p);
  // Nothing matched every word: fall back to anything matching at least one word.
  const words = tokens(query);
  return list
    .map((p) => ({ p, s: Math.max(0, ...words.map((w) => searchScore(w, p))) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}
