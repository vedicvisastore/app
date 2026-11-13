/**
 * Store themes. Each theme overrides the brand colour tokens from src/app/tokens.css; every component
 * already paints with those tokens, so switching a theme re-colours the whole site without touching code.
 * Role names stay the same across themes:
 *   field   (shyam*)   the deep band colour: hero tiles, footer, shloka band
 *   primary (royal*)   the main colour block (hero tile, links)
 *   button  (gold*)    filled buttons, highlights (text on it uses the field colour)
 *   accent  (gulal*)   sale tags, the second colour block
 *   paper/ink          page background and text
 */
export type ThemeTokens = Record<string, string>;
export type Theme = { key: string; name: string; mood: string; tokens: ThemeTokens };

const t = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`--color-${k}`, v]));

export const THEMES: Theme[] = [
  {
    key: "vrindavan",
    name: "Vrindavan Blue",
    mood: "Krishna's blue with bansuri gold. The original look.",
    // Same values as src/app/tokens.css, listed so previews and switching back are exact.
    tokens: t({ "paper": "oklch(97.6% 0.008 236)", "paper-2": "oklch(94.6% 0.018 232)", "paper-3": "oklch(90.5% 0.03 232)", "ink": "oklch(22% 0.075 268)", "ink-2": "oklch(38% 0.06 266)", "muted": "oklch(50% 0.045 262)", "rule": "oklch(88.5% 0.022 240)", "focus": "oklch(46% 0.2 266)", "field-edge": "oklch(62% 0.04 255)", "shyam": "oklch(23% 0.085 268)", "shyam-2": "oklch(29% 0.095 268)", "shyam-3": "oklch(36% 0.1 268)", "on-shyam": "oklch(95.5% 0.018 85)", "on-shyam-2": "oklch(82% 0.035 255)", "shyam-word": "oklch(56% 0.13 268)", "royal": "oklch(46% 0.2 266)", "royal-deep": "oklch(38% 0.18 266)", "gold": "oklch(80% 0.145 80)", "gold-deep": "oklch(74% 0.15 76)", "gold-soft": "oklch(95% 0.04 88)", "gold-ink": "oklch(50% 0.11 72)", "gulal": "oklch(53% 0.21 355)", "gulal-deep": "oklch(48% 0.2 355)", "gulal-soft": "oklch(95% 0.03 355)", "peacock": "oklch(52% 0.115 205)", "peacock-deep": "oklch(46% 0.11 205)" }),
  },
  {
    key: "kesariya",
    name: "Kesariya",
    mood: "Saffron and marigold on deep maroon. Festive, for Diwali and Navratri.",
    tokens: t({
      paper: "oklch(97.6% 0.012 70)", "paper-2": "oklch(94.6% 0.028 65)", "paper-3": "oklch(90.5% 0.045 62)",
      ink: "oklch(24% 0.07 25)", "ink-2": "oklch(39% 0.07 30)", muted: "oklch(50% 0.06 35)", rule: "oklch(88.5% 0.03 60)",
      focus: "oklch(48% 0.18 35)", "field-edge": "oklch(62% 0.06 45)",
      shyam: "oklch(25% 0.085 22)", "shyam-2": "oklch(31% 0.095 22)", "shyam-3": "oklch(38% 0.1 24)",
      "on-shyam": "oklch(96% 0.02 80)", "on-shyam-2": "oklch(84% 0.04 60)", "shyam-word": "oklch(58% 0.14 30)",
      royal: "oklch(54% 0.17 42)", "royal-deep": "oklch(47% 0.16 38)",
      gold: "oklch(82% 0.16 82)", "gold-deep": "oklch(76% 0.16 78)", "gold-soft": "oklch(95% 0.05 88)", "gold-ink": "oklch(50% 0.11 70)",
      gulal: "oklch(53% 0.21 0)", "gulal-deep": "oklch(47% 0.2 0)", "gulal-soft": "oklch(95% 0.03 0)",
      peacock: "oklch(50% 0.12 170)", "peacock-deep": "oklch(44% 0.11 170)",
    }),
  },
  {
    key: "tulsi",
    name: "Tulsi",
    mood: "Calm tulsi green and turmeric. Quiet, for everyday japa.",
    tokens: t({
      paper: "oklch(97.6% 0.01 150)", "paper-2": "oklch(94.6% 0.022 150)", "paper-3": "oklch(90.5% 0.035 150)",
      ink: "oklch(23% 0.05 160)", "ink-2": "oklch(38% 0.05 160)", muted: "oklch(49% 0.04 160)", rule: "oklch(88.5% 0.025 150)",
      focus: "oklch(45% 0.13 155)", "field-edge": "oklch(62% 0.04 155)",
      shyam: "oklch(26% 0.06 162)", "shyam-2": "oklch(32% 0.07 162)", "shyam-3": "oklch(39% 0.075 162)",
      "on-shyam": "oklch(96% 0.02 100)", "on-shyam-2": "oklch(84% 0.04 150)", "shyam-word": "oklch(58% 0.1 158)",
      royal: "oklch(48% 0.12 155)", "royal-deep": "oklch(41% 0.11 158)",
      gold: "oklch(84% 0.15 92)", "gold-deep": "oklch(78% 0.15 88)", "gold-soft": "oklch(95% 0.05 95)", "gold-ink": "oklch(50% 0.1 85)",
      gulal: "oklch(58% 0.17 355)", "gulal-deep": "oklch(51% 0.17 355)", "gulal-soft": "oklch(95% 0.03 355)",
      peacock: "oklch(52% 0.1 200)", "peacock-deep": "oklch(46% 0.1 200)",
    }),
  },
  {
    key: "rani",
    name: "Rani",
    mood: "Rani pink and plum with gold. Bold and young.",
    tokens: t({
      paper: "oklch(97.6% 0.01 350)", "paper-2": "oklch(94.6% 0.025 350)", "paper-3": "oklch(90.5% 0.04 350)",
      ink: "oklch(23% 0.07 330)", "ink-2": "oklch(38% 0.07 335)", muted: "oklch(49% 0.06 340)", rule: "oklch(88.5% 0.03 345)",
      focus: "oklch(48% 0.2 350)", "field-edge": "oklch(62% 0.05 345)",
      shyam: "oklch(24% 0.08 325)", "shyam-2": "oklch(30% 0.095 325)", "shyam-3": "oklch(37% 0.11 328)",
      "on-shyam": "oklch(96% 0.02 350)", "on-shyam-2": "oklch(84% 0.05 340)", "shyam-word": "oklch(58% 0.15 335)",
      royal: "oklch(52% 0.21 355)", "royal-deep": "oklch(45% 0.2 355)",
      gold: "oklch(82% 0.15 82)", "gold-deep": "oklch(76% 0.15 78)", "gold-soft": "oklch(95% 0.045 88)", "gold-ink": "oklch(50% 0.11 70)",
      gulal: "oklch(55% 0.17 40)", "gulal-deep": "oklch(49% 0.16 38)", "gulal-soft": "oklch(95% 0.03 45)",
      peacock: "oklch(48% 0.12 300)", "peacock-deep": "oklch(42% 0.12 300)",
    }),
  },
  {
    key: "yamuna",
    name: "Yamuna",
    mood: "Peacock teal and river blue with coral. Fresh and cool.",
    tokens: t({
      paper: "oklch(97.6% 0.01 210)", "paper-2": "oklch(94.6% 0.022 205)", "paper-3": "oklch(90.5% 0.035 205)",
      ink: "oklch(23% 0.05 225)", "ink-2": "oklch(38% 0.05 220)", muted: "oklch(49% 0.04 215)", rule: "oklch(88.5% 0.025 210)",
      focus: "oklch(46% 0.12 210)", "field-edge": "oklch(62% 0.04 210)",
      shyam: "oklch(27% 0.06 222)", "shyam-2": "oklch(33% 0.07 220)", "shyam-3": "oklch(40% 0.08 218)",
      "on-shyam": "oklch(96% 0.015 200)", "on-shyam-2": "oklch(84% 0.04 205)", "shyam-word": "oklch(58% 0.09 210)",
      royal: "oklch(50% 0.11 205)", "royal-deep": "oklch(43% 0.1 208)",
      gold: "oklch(83% 0.14 85)", "gold-deep": "oklch(77% 0.14 82)", "gold-soft": "oklch(95% 0.045 88)", "gold-ink": "oklch(50% 0.1 75)",
      gulal: "oklch(62% 0.17 28)", "gulal-deep": "oklch(55% 0.17 28)", "gulal-soft": "oklch(95% 0.03 30)",
      peacock: "oklch(45% 0.13 265)", "peacock-deep": "oklch(39% 0.13 265)",
    }),
  },
];

export type CustomTheme = { field: string; primary: string; button: string; accent: string; paper: string };

export const DEFAULT_CUSTOM: CustomTheme = { field: "#141c4c", primary: "#2b49c8", button: "#efb233", accent: "#c91c78", paper: "#f2f7fb" };

const HEX = /^#[0-9a-f]{6}$/i;

/** Builds a full token set from five picked colours; the shades are mixed in CSS so they always match. */
export function customTokens(c: CustomTheme): ThemeTokens {
  const ok = (v: string, d: string) => (HEX.test(v) ? v : d);
  const field = ok(c.field, DEFAULT_CUSTOM.field);
  const primary = ok(c.primary, DEFAULT_CUSTOM.primary);
  const button = ok(c.button, DEFAULT_CUSTOM.button);
  const accent = ok(c.accent, DEFAULT_CUSTOM.accent);
  const paper = ok(c.paper, DEFAULT_CUSTOM.paper);
  const mix = (a: string, b: string, p: number) => `color-mix(in oklab, ${a} ${p}%, ${b})`;
  return t({
    paper, "paper-2": mix(paper, field, 94), "paper-3": mix(paper, field, 87),
    ink: mix(field, "oklch(15% 0 0)", 85), "ink-2": mix(field, paper, 75), muted: mix(field, paper, 60), rule: mix(paper, field, 86),
    focus: primary, "field-edge": mix(field, paper, 50),
    shyam: field, "shyam-2": mix(field, paper, 90), "shyam-3": mix(field, paper, 80),
    "on-shyam": mix(paper, "oklch(100% 0 0)", 60), "on-shyam-2": mix(paper, field, 78), "shyam-word": mix(primary, paper, 75),
    royal: primary, "royal-deep": mix(primary, field, 82),
    gold: button, "gold-deep": mix(button, field, 88), "gold-soft": mix(button, paper, 18), "gold-ink": mix(button, field, 55),
    gulal: accent, "gulal-deep": mix(accent, field, 85), "gulal-soft": mix(accent, paper, 10),
  });
}

export function themeTokens(key: string, custom?: CustomTheme | null): ThemeTokens {
  if (key === "custom") return customTokens(custom ?? DEFAULT_CUSTOM);
  return THEMES.find((x) => x.key === key)?.tokens ?? {};
}

/** CSS for a <style> tag: overrides on :root (and a scoped version for previews). */
export function themeCss(tokens: ThemeTokens, selector = ":root") {
  const body = Object.entries(tokens)
    .filter(([k, v]) => /^--color-[a-z0-9-]+$/.test(k) && /^[#a-z0-9 .%(),\-]+$/i.test(v))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return body ? `${selector}{${body}}` : "";
}
