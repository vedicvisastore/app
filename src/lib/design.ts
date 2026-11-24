/**
 * Store design the owner controls from the visual editor (Admin → Visual editor → Design), on top of the theme:
 *   - colours: the brand's main colours (every shade made from them follows)
 *   - fonts: the heading font and the body font, used everywhere
 *   - look: corners, button shape, text size, section spacing, shadows
 *   - blocks: one part of the store (a section, the menu bar, or every product card at once) restyled on its own
 *
 * Saved as `design` in the site config file. Turned into one CSS string here (server and editor share this file),
 * which the store layout puts in the page, so the first paint is already right: no flash.
 */

// ── Colours ────────────────────────────────────────────────
export const COLOR_ROLES = [
  { token: "shyam", label: "Deep colour", hint: "Menu bar, footer, dark bands" },
  { token: "royal", label: "Bright colour", hint: "Links, highlights, active states" },
  { token: "gold", label: "Button colour", hint: "Main buttons and badges" },
  { token: "gulal", label: "Accent colour", hint: "Sale prices, offers, small accents" },
  { token: "peacock", label: "Second accent", hint: "Tiles and decorations" },
  { token: "mor", label: "Success colour", hint: "Free shipping, savings, in stock" },
  { token: "paper", label: "Page background", hint: "Behind everything" },
  { token: "ink", label: "Text colour", hint: "Headings and body text" },
] as const;
export type ColorToken = (typeof COLOR_ROLES)[number]["token"];

/** Shades that follow each main colour, mixed in CSS so they always match it. */
function shadesFor(token: ColorToken, v: string): Record<string, string> {
  const mix = (a: string, b: string, p: number) => `color-mix(in oklab, ${a} ${p}%, ${b})`;
  const paper = "var(--color-paper)";
  const ink = "var(--color-ink)";
  switch (token) {
    case "shyam":
      return { shyam: v, "shyam-2": mix(v, "white", 90), "shyam-3": mix(v, "white", 80), "field-edge": mix(v, paper, 50) };
    case "royal":
      return { royal: v, "royal-deep": mix(v, "black", 82), focus: v, "shyam-word": mix(v, "white", 75) };
    case "gold":
      return { gold: v, accent: v, "gold-deep": mix(v, "black", 90), "gold-soft": mix(v, "white", 16), "gold-ink": mix(v, "black", 58) };
    case "gulal":
      return { gulal: v, "gulal-deep": mix(v, "black", 88), "gulal-soft": mix(v, "white", 10) };
    case "peacock":
      return { peacock: v, "peacock-deep": mix(v, "black", 88) };
    case "mor":
      return { mor: v, "mor-deep": mix(v, "black", 88), "mor-soft": mix(v, "white", 10), success: v };
    case "paper":
      return { paper: v, "paper-2": mix(v, ink, 95), "paper-3": mix(v, ink, 89), rule: mix(v, ink, 87) };
    case "ink":
      return { ink: v, "ink-2": mix(v, paper, 78), muted: mix(v, paper, 62), "accent-ink": v };
  }
}

// ── Fonts ──────────────────────────────────────────────────
/** lang: "deva" fonts also have Devanagari (Hindi) letters; "latin" fonts are English only. */
type Font = { label: string; family: string; stack: string; google?: string; lang: "deva" | "latin"; kind: FontKind };
export type FontKind = "serif" | "sans" | "display" | "rounded" | "handwritten";
export const FONT_LANGS = { deva: "Hindi + English", latin: "English only" } as const;
export const FONT_KINDS: Record<FontKind, string> = { serif: "Serif (classic)", sans: "Sans serif (clean)", display: "Display (bold titles)", rounded: "Rounded (soft)", handwritten: "Handwritten" };
// Every Google family below was checked against the Google Fonts API (weights and Devanagari coverage).
export const FONTS = {
  rozha: { label: "Rozha One (current)", family: "Rozha One", stack: 'var(--font-rozha), "Rozha One", Georgia, serif', lang: "deva", kind: "display" },
  satoshi: { label: "Satoshi (current)", family: "Satoshi", stack: '"Satoshi", ui-sans-serif, system-ui, sans-serif', lang: "latin", kind: "sans" },
  yatra: { label: "Yatra One", family: "Yatra One", stack: '"Yatra One", Georgia, serif', google: "Yatra+One", lang: "deva", kind: "display" },
  laila: { label: "Laila", family: "Laila", stack: '"Laila", Georgia, serif', google: "Laila:wght@400;700", lang: "deva", kind: "serif" },
  martel: { label: "Martel", family: "Martel", stack: '"Martel", Georgia, serif', google: "Martel:wght@400;700", lang: "deva", kind: "serif" },
  tiro: { label: "Tiro Devanagari Hindi", family: "Tiro Devanagari Hindi", stack: '"Tiro Devanagari Hindi", Georgia, serif', google: "Tiro+Devanagari+Hindi", lang: "deva", kind: "serif" },
  notoSerifDeva: { label: "Noto Serif Devanagari", family: "Noto Serif Devanagari", stack: '"Noto Serif Devanagari", Georgia, serif', google: "Noto+Serif+Devanagari:wght@400;700", lang: "deva", kind: "serif" },
  eczar: { label: "Eczar", family: "Eczar", stack: '"Eczar", Georgia, serif', google: "Eczar:wght@400;700", lang: "deva", kind: "serif" },
  kurale: { label: "Kurale", family: "Kurale", stack: '"Kurale", Georgia, serif', google: "Kurale", lang: "deva", kind: "serif" },
  vesper: { label: "Vesper Libre", family: "Vesper Libre", stack: '"Vesper Libre", Georgia, serif', google: "Vesper+Libre:wght@400;700", lang: "deva", kind: "serif" },
  halant: { label: "Halant", family: "Halant", stack: '"Halant", Georgia, serif', google: "Halant:wght@400;700", lang: "deva", kind: "serif" },
  gotu: { label: "Gotu", family: "Gotu", stack: '"Gotu", Georgia, serif', google: "Gotu", lang: "deva", kind: "serif" },
  poppins: { label: "Poppins", family: "Poppins", stack: '"Poppins", ui-sans-serif, system-ui, sans-serif', google: "Poppins:wght@400;700", lang: "deva", kind: "sans" },
  mukta: { label: "Mukta", family: "Mukta", stack: '"Mukta", ui-sans-serif, system-ui, sans-serif', google: "Mukta:wght@400;700", lang: "deva", kind: "sans" },
  hind: { label: "Hind", family: "Hind", stack: '"Hind", ui-sans-serif, system-ui, sans-serif', google: "Hind:wght@400;700", lang: "deva", kind: "sans" },
  notoSansDeva: { label: "Noto Sans Devanagari", family: "Noto Sans Devanagari", stack: '"Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif', google: "Noto+Sans+Devanagari:wght@400;700", lang: "deva", kind: "sans" },
  palanquin: { label: "Palanquin", family: "Palanquin", stack: '"Palanquin", ui-sans-serif, system-ui, sans-serif', google: "Palanquin:wght@400;700", lang: "deva", kind: "sans" },
  karma: { label: "Karma", family: "Karma", stack: '"Karma", ui-sans-serif, system-ui, sans-serif', google: "Karma:wght@400;700", lang: "deva", kind: "sans" },
  rajdhani: { label: "Rajdhani", family: "Rajdhani", stack: '"Rajdhani", ui-sans-serif, system-ui, sans-serif', google: "Rajdhani:wght@400;700", lang: "deva", kind: "sans" },
  khand: { label: "Khand", family: "Khand", stack: '"Khand", ui-sans-serif, system-ui, sans-serif', google: "Khand:wght@400;700", lang: "deva", kind: "sans" },
  teko: { label: "Teko", family: "Teko", stack: '"Teko", ui-sans-serif, system-ui, sans-serif', google: "Teko:wght@400;700", lang: "deva", kind: "display" },
  sarpanch: { label: "Sarpanch", family: "Sarpanch", stack: '"Sarpanch", ui-sans-serif, system-ui, sans-serif', google: "Sarpanch:wght@400;700", lang: "deva", kind: "display" },
  modak: { label: "Modak", family: "Modak", stack: '"Modak", ui-sans-serif, system-ui, sans-serif', google: "Modak", lang: "deva", kind: "display" },
  baloo: { label: "Baloo 2 (rounded)", family: "Baloo 2", stack: '"Baloo 2", ui-rounded, ui-sans-serif, sans-serif', google: "Baloo+2:wght@400;700", lang: "deva", kind: "rounded" },
  kalam: { label: "Kalam", family: "Kalam", stack: '"Kalam", cursive', google: "Kalam:wght@400;700", lang: "deva", kind: "handwritten" },
  amita: { label: "Amita", family: "Amita", stack: '"Amita", cursive', google: "Amita:wght@400;700", lang: "deva", kind: "handwritten" },
  tillana: { label: "Tillana", family: "Tillana", stack: '"Tillana", cursive', google: "Tillana:wght@400;700", lang: "deva", kind: "handwritten" },
  dekko: { label: "Dekko", family: "Dekko", stack: '"Dekko", cursive', google: "Dekko", lang: "deva", kind: "handwritten" },
  playfair: { label: "Playfair Display", family: "Playfair Display", stack: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@400;700", lang: "latin", kind: "serif" },
  dmSerif: { label: "DM Serif Display", family: "DM Serif Display", stack: '"DM Serif Display", Georgia, serif', google: "DM+Serif+Display", lang: "latin", kind: "serif" },
  fraunces: { label: "Fraunces", family: "Fraunces", stack: '"Fraunces", Georgia, serif', google: "Fraunces:wght@400;700", lang: "latin", kind: "serif" },
  lora: { label: "Lora", family: "Lora", stack: '"Lora", Georgia, serif', google: "Lora:wght@400;700", lang: "latin", kind: "serif" },
  cormorant: { label: "Cormorant Garamond", family: "Cormorant Garamond", stack: '"Cormorant Garamond", Georgia, serif', google: "Cormorant+Garamond:wght@400;700", lang: "latin", kind: "serif" },
  ebGaramond: { label: "EB Garamond", family: "EB Garamond", stack: '"EB Garamond", Georgia, serif', google: "EB+Garamond:wght@400;700", lang: "latin", kind: "serif" },
  libreBaskerville: { label: "Libre Baskerville", family: "Libre Baskerville", stack: '"Libre Baskerville", Georgia, serif', google: "Libre+Baskerville:wght@400;700", lang: "latin", kind: "serif" },
  merriweather: { label: "Merriweather", family: "Merriweather", stack: '"Merriweather", Georgia, serif', google: "Merriweather:wght@400;700", lang: "latin", kind: "serif" },
  marcellus: { label: "Marcellus", family: "Marcellus", stack: '"Marcellus", Georgia, serif', google: "Marcellus", lang: "latin", kind: "serif" },
  cinzel: { label: "Cinzel", family: "Cinzel", stack: '"Cinzel", Georgia, serif', google: "Cinzel:wght@400;700", lang: "latin", kind: "serif" },
  inter: { label: "Inter", family: "Inter", stack: '"Inter", ui-sans-serif, system-ui, sans-serif', google: "Inter:wght@400;700", lang: "latin", kind: "sans" },
  dmSans: { label: "DM Sans", family: "DM Sans", stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif', google: "DM+Sans:wght@400;700", lang: "latin", kind: "sans" },
  manrope: { label: "Manrope", family: "Manrope", stack: '"Manrope", ui-sans-serif, system-ui, sans-serif', google: "Manrope:wght@400;700", lang: "latin", kind: "sans" },
  montserrat: { label: "Montserrat", family: "Montserrat", stack: '"Montserrat", ui-sans-serif, system-ui, sans-serif', google: "Montserrat:wght@400;700", lang: "latin", kind: "sans" },
  outfit: { label: "Outfit", family: "Outfit", stack: '"Outfit", ui-sans-serif, system-ui, sans-serif', google: "Outfit:wght@400;700", lang: "latin", kind: "sans" },
  jakarta: { label: "Plus Jakarta Sans", family: "Plus Jakarta Sans", stack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif', google: "Plus+Jakarta+Sans:wght@400;700", lang: "latin", kind: "sans" },
  workSans: { label: "Work Sans", family: "Work Sans", stack: '"Work Sans", ui-sans-serif, system-ui, sans-serif', google: "Work+Sans:wght@400;700", lang: "latin", kind: "sans" },
  spaceGrotesk: { label: "Space Grotesk", family: "Space Grotesk", stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif', google: "Space+Grotesk:wght@400;700", lang: "latin", kind: "sans" },
  raleway: { label: "Raleway", family: "Raleway", stack: '"Raleway", ui-sans-serif, system-ui, sans-serif', google: "Raleway:wght@400;700", lang: "latin", kind: "sans" },
  josefin: { label: "Josefin Sans", family: "Josefin Sans", stack: '"Josefin Sans", ui-sans-serif, system-ui, sans-serif', google: "Josefin+Sans:wght@400;700", lang: "latin", kind: "sans" },
  abril: { label: "Abril Fatface", family: "Abril Fatface", stack: '"Abril Fatface", Georgia, serif', google: "Abril+Fatface", lang: "latin", kind: "display" },
  bebas: { label: "Bebas Neue", family: "Bebas Neue", stack: '"Bebas Neue", ui-sans-serif, system-ui, sans-serif', google: "Bebas+Neue", lang: "latin", kind: "display" },
  righteous: { label: "Righteous", family: "Righteous", stack: '"Righteous", ui-sans-serif, system-ui, sans-serif', google: "Righteous", lang: "latin", kind: "display" },
  nunito: { label: "Nunito", family: "Nunito", stack: '"Nunito", ui-rounded, ui-sans-serif, sans-serif', google: "Nunito:wght@400;700", lang: "latin", kind: "rounded" },
  quicksand: { label: "Quicksand", family: "Quicksand", stack: '"Quicksand", ui-rounded, ui-sans-serif, sans-serif', google: "Quicksand:wght@400;700", lang: "latin", kind: "rounded" },
  comfortaa: { label: "Comfortaa", family: "Comfortaa", stack: '"Comfortaa", ui-rounded, ui-sans-serif, sans-serif', google: "Comfortaa:wght@400;700", lang: "latin", kind: "rounded" },
  dancing: { label: "Dancing Script", family: "Dancing Script", stack: '"Dancing Script", cursive', google: "Dancing+Script:wght@400;700", lang: "latin", kind: "handwritten" },
  caveat: { label: "Caveat", family: "Caveat", stack: '"Caveat", cursive', google: "Caveat:wght@400;700", lang: "latin", kind: "handwritten" },
  pacifico: { label: "Pacifico", family: "Pacifico", stack: '"Pacifico", cursive', google: "Pacifico", lang: "latin", kind: "handwritten" },
  greatVibes: { label: "Great Vibes", family: "Great Vibes", stack: '"Great Vibes", cursive', google: "Great+Vibes", lang: "latin", kind: "handwritten" },
  satisfy: { label: "Satisfy", family: "Satisfy", stack: '"Satisfy", cursive', google: "Satisfy", lang: "latin", kind: "handwritten" },
} satisfies Record<string, Font>;
export type FontKey = keyof typeof FONTS;
export const isFontKey = (k: unknown): k is FontKey => typeof k === "string" && k in FONTS;
export const FONT_ROLES = [
  { role: "display", label: "Heading font", hint: "Titles, product names on cards, big numbers", fallback: "rozha" },
  { role: "body", label: "Body font", hint: "Everything else: text, buttons, menus, prices", fallback: "satoshi" },
] as const;

// ── Look ───────────────────────────────────────────────────
export const LOOK = {
  corners: { label: "Corners", hint: "Cards, photos and boxes", options: { sharp: "Sharp", soft: "Soft", round: "Round" }, default: "soft" },
  buttons: { label: "Button shape", hint: "Every button in the store", options: { pill: "Pill", rounded: "Rounded", square: "Square" }, default: "pill" },
  text: { label: "Text size", hint: "All text, scaled together", options: { s: "Smaller", m: "Normal", l: "Larger" }, default: "m" },
  spacing: { label: "Space between sections", hint: "How airy the pages feel", options: { compact: "Compact", normal: "Normal", airy: "Airy" }, default: "normal" },
  shadows: { label: "Shadows", hint: "Depth under cards and menus", options: { none: "None", soft: "Soft", deep: "Deep" }, default: "soft" },
} as const;
export type LookKey = keyof typeof LOOK;

// ── Blocks: parts of the store that can be restyled on their own ──
export type BlockProp = "bg" | "text" | "heading" | "headingFont" | "bodyFont" | "radius";
/** page: a store page where the part can be seen ("product" = any product page; none = on every page). */
type Block = { label: string; group: string; selector: string; props: BlockProp[]; repeat?: string; page?: string };
const S = (k: string) => `[data-s="${k}"]`;
export const BLOCKS = {
  ribbon: { label: "Top ribbon", group: "Header and footer", selector: S("ribbon"), props: ["bg", "text", "bodyFont"] },
  header: { label: "Header (logo row)", group: "Header and footer", selector: S("header"), props: ["bg"] },
  menu: { label: "Menu bar", group: "Header and footer", selector: S("menu"), props: ["bg", "text", "bodyFont"] },
  footer: { label: "Footer", group: "Header and footer", selector: S("footer"), props: ["bg", "text", "heading", "headingFont"] },
  "home.banner": { label: "Home banner", group: "Home page", selector: S("home.banner"), props: ["text", "heading", "headingFont"] , page: "/" },
  "home.picks": { label: "Bestsellers and offers", group: "Home page", selector: S("home.picks"), props: ["bg", "heading", "headingFont"] , page: "/" },
  "home.cats": { label: "Shop by category", group: "Home page", selector: S("home.cats"), props: ["bg", "heading", "headingFont"] , page: "/" },
  "home.boxes": { label: "Bhakti Boxes section", group: "Home page", selector: S("home.boxes"), props: ["bg", "text", "heading", "headingFont"] , page: "/" },
  "home.essentials": { label: "Popular items section", group: "Home page", selector: S("home.essentials"), props: ["bg", "heading", "headingFont"] , page: "/" },
  "home.sets": { label: "Japa and Shringar sets", group: "Home page", selector: S("home.sets"), props: ["bg", "text", "heading", "headingFont"] , page: "/" },
  "home.shloka": { label: "Dharma band", group: "Home page", selector: S("home.shloka"), props: ["bg", "text", "heading", "headingFont"] , page: "/" },
  "home.follow": { label: "Follow us section", group: "Home page", selector: S("home.follow"), props: ["bg", "heading", "headingFont"] , page: "/" },
  band: { label: "Page title bands", group: "Pages", selector: S("band"), props: ["bg", "text", "heading", "headingFont"], repeat: "every page's title band" , page: "/deals" },
  "product.main": { label: "Product page top", group: "Pages", selector: S("product.main"), props: ["bg", "text", "heading", "headingFont"] , page: "product" },
  "product.related": { label: "You may also like", group: "Pages", selector: S("product.related"), props: ["bg", "heading", "headingFont"] , page: "product" },
  "card.product": { label: "Product cards", group: "Cards and buttons", selector: S("card.product"), props: ["bg", "text", "heading", "headingFont", "radius"], repeat: "every product card" , page: "/shop" },
  "card.box": { label: "Bhakti Box cards", group: "Cards and buttons", selector: S("card.box"), props: ["bg", "text", "heading", "headingFont", "radius"], repeat: "every box card" , page: "/" },
  "card.category": { label: "Category tiles", group: "Cards and buttons", selector: S("card.category"), props: ["text", "radius"], repeat: "every category tile" , page: "/" },
  "button.primary": { label: "Main buttons", group: "Cards and buttons", selector: ".vv-btn-primary", props: ["bg", "text", "radius"], repeat: "every main button" , page: "/" },
  "button.outline": { label: "Outline buttons", group: "Cards and buttons", selector: ".vv-btn-outline", props: ["text", "radius"], repeat: "every outline button" , page: "/" },
} satisfies Record<string, Block>;
export type BlockKey = keyof typeof BLOCKS;
export const isBlockKey = (k: unknown): k is BlockKey => typeof k === "string" && k in BLOCKS;
export const BLOCK_PROP_LABEL: Record<BlockProp, string> = {
  bg: "Background",
  text: "Text colour",
  heading: "Heading colour",
  headingFont: "Heading font",
  bodyFont: "Text font",
  radius: "Corner roundness",
};

export type BlockStyle = { bg?: string; text?: string; heading?: string; headingFont?: FontKey; bodyFont?: FontKey; radius?: number };
export type Design = {
  colors?: Partial<Record<ColorToken, string>>;
  fonts?: { display?: FontKey; body?: FontKey };
  look?: { [K in LookKey]?: keyof (typeof LOOK)[K]["options"] };
  blocks?: Partial<Record<BlockKey, BlockStyle>>;
};

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** Keeps only known keys and safe values (saved designs are fed straight into CSS). */
export function cleanDesign(input: unknown): Design {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, Record<string, unknown>>;
  const out: Design = {};
  const colors = Object.fromEntries(COLOR_ROLES.map((r) => [r.token, d.colors?.[r.token]]).filter(([, v]) => isHex(v)));
  if (Object.keys(colors).length) out.colors = colors;
  const fonts = Object.fromEntries((["display", "body"] as const).map((r) => [r, d.fonts?.[r]]).filter(([, v]) => isFontKey(v)));
  if (Object.keys(fonts).length) out.fonts = fonts;
  const look = Object.fromEntries(
    (Object.keys(LOOK) as LookKey[]).map((k) => [k, d.look?.[k]]).filter(([k, v]) => typeof v === "string" && v in LOOK[k as LookKey].options && v !== LOOK[k as LookKey].default),
  );
  if (Object.keys(look).length) out.look = look;
  const blocks: Design["blocks"] = {};
  for (const [k, raw] of Object.entries((d.blocks ?? {}) as Record<string, Record<string, unknown>>)) {
    if (!isBlockKey(k) || !raw || typeof raw !== "object") continue;
    const allowed = BLOCKS[k].props as readonly BlockProp[];
    const s: BlockStyle = {};
    for (const p of allowed) {
      const v = raw[p];
      if ((p === "bg" || p === "text" || p === "heading") && isHex(v)) s[p] = v;
      if ((p === "headingFont" || p === "bodyFont") && isFontKey(v)) s[p] = v;
      if (p === "radius" && typeof v === "number" && v >= 0 && v <= 48) s.radius = Math.round(v);
    }
    if (Object.keys(s).length) blocks[k] = s;
  }
  if (Object.keys(blocks).length) out.blocks = blocks;
  return out;
}

const LOOK_CSS: { [K in LookKey]: Record<string, string> } = {
  corners: { sharp: "--radius-card:4px", soft: "", round: "--radius-card:26px" },
  buttons: { pill: "", rounded: "--radius-button:12px", square: "--radius-button:3px" },
  text: { s: "font-size:93.75%", m: "", l: "font-size:106.25%" },
  spacing: { compact: "--section-scale:0.7", normal: "", airy: "--section-scale:1.3" },
  shadows: {
    none: "--shadow-card:none;--shadow-lift:none;--shadow-float:0 0 0 1px var(--color-rule)",
    soft: "",
    deep: "--shadow-card:0 2px 6px oklch(20% 0.05 268 / .12);--shadow-lift:0 2px 6px oklch(20% 0.05 268 / .1),0 16px 32px -14px oklch(20% 0.05 268 / .4);--shadow-float:0 4px 12px oklch(20% 0.05 268 / .14),0 32px 64px -24px oklch(20% 0.05 268 / .5)",
  },
};

/** The CSS for a design (empty string when nothing is changed). */
export function designCss(input: Design): string {
  const d = cleanDesign(input);
  const root: string[] = [];
  for (const [token, v] of Object.entries(d.colors ?? {}) as [ColorToken, string][])
    for (const [name, value] of Object.entries(shadesFor(token, v))) root.push(`--color-${name}:${value}`);
  if (d.fonts?.display) root.push(`--font-display:${FONTS[d.fonts.display].stack}`);
  if (d.fonts?.body) root.push(`--font-body:${FONTS[d.fonts.body].stack}`);
  for (const [k, v] of Object.entries(d.look ?? {}) as [LookKey, string][]) {
    const css = (LOOK_CSS[k] as Record<string, string>)[v];
    if (css) root.push(css);
  }
  const rules: string[] = [];
  if (root.length) rules.push(`html:root{${root.join(";")}}`);
  for (const [k, s] of Object.entries(d.blocks ?? {}) as [BlockKey, BlockStyle][]) {
    const sel = BLOCKS[k].selector;
    const own: string[] = [];
    if (s.bg) own.push(`background-color:${s.bg}`, "background-image:none");
    if (s.text) own.push(`color:${s.text}`);
    if (s.bodyFont) own.push(`font-family:${FONTS[s.bodyFont].stack}`);
    // Roundness is passed down as the card/button radius variables the components already use.
    if (s.radius !== undefined) own.push(`--radius-card:${s.radius}px`, `--radius-button:${s.radius}px`);
    if (own.length) rules.push(`${sel}{${own.join(";")}}`);
    // Text colour reaches plain text and links inside, not coloured details like prices or badges.
    if (s.text) rules.push(`:where(${sel}) :is(p,li,a,span,dd,dt,label):not([class*="text-gulal"],[class*="text-mor"],[class*="bg-"],.vv-btn,.vv-btn *){color:${s.text}}`);
    const head: string[] = [];
    if (s.heading) head.push(`color:${s.heading}`);
    if (s.headingFont) head.push(`font-family:${FONTS[s.headingFont].stack}`);
    if (head.length) rules.push(`:where(${sel}) :is(h1,h2,h3,.font-display){${head.join(";")}}`);
    if (s.bodyFont) rules.push(`:where(${sel}) :is(p,li,a,button,span,input):not(.font-display){font-family:${FONTS[s.bodyFont].stack}}`);
  }
  return rules.join("\n");
}

/** Google Fonts stylesheet for the fonts this design uses (null when only the built-in fonts are used). */
export function designFontsHref(input: Design): string | null {
  const d = cleanDesign(input);
  const keys = new Set<FontKey>();
  if (d.fonts?.display) keys.add(d.fonts.display);
  if (d.fonts?.body) keys.add(d.fonts.body);
  for (const s of Object.values(d.blocks ?? {})) {
    if (s?.headingFont) keys.add(s.headingFont);
    if (s?.bodyFont) keys.add(s.bodyFont);
  }
  const families = [...keys].map((k) => (FONTS[k] as Font).google).filter((g): g is string => !!g);
  return families.length ? `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap` : null;
}
