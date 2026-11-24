/**
 * Runs inside the store page when an admin opens it in the visual editor (Admin → Store text → Visual editor).
 * Loaded on demand only in edit mode, so shoppers never download it.
 *
 * - Finds text tagged with its content key (src/lib/stega.ts), removes the invisible tag and marks the element.
 * - In edit mode, tapping marked text asks the editor (the parent window) to edit that key; tapping a product,
 *   the banner or the shop menu asks it to open the matching admin page.
 * - Applies edits the editor sends back straight into the page, so typing shows instantly.
 * - In style mode, tapping a part of the page (a section, the menu, a card…) asks the editor to style that part,
 *   and the editor's unsaved design arrives as CSS that replaces the saved design while editing.
 */
import { BLOCKS, COLOR_ROLES, type BlockKey } from "@/lib/design";
import { decodeTag, TAG_RE } from "@/lib/stega";

type Mode = "edit" | "style" | "browse";
type Msg =
  | { type: "vv:mode"; mode: Mode }
  | { type: "vv:design"; css: string; fonts: string | null }
  | { type: "vv:tokens" }
  | { type: "vv:selectBlock"; key: string | null }
  | { type: "vv:set"; key: string; value: string }
  | { type: "vv:select"; key: string | null }
  | { type: "vv:img"; key: string; src: string };

const KEY_ATTR = "data-vv-key";
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

let started = false;

export function start() {
  if (started || window.parent === window) return;
  started = true;
  const nodes = new Map<string, Set<Text>>();
  let mode: Mode = "edit";
  const blockKeys = Object.keys(BLOCKS) as BlockKey[];
  const blockSel = blockKeys.map((k) => BLOCKS[k].selector).join(",");
  const blockOf = (el: Element) => blockKeys.find((k) => el.matches(BLOCKS[k].selector)) ?? null;
  let parentOrigin = "*";
  let lastHref = "";

  const post = (msg: Record<string, unknown>) => window.parent.postMessage(msg, parentOrigin);

  const style = document.createElement("style");
  style.textContent = `
    html.vv-editing [${KEY_ATTR}] { outline: 1.5px dashed color-mix(in oklab, var(--color-gulal) 65%, transparent); outline-offset: 2px; border-radius: 3px; cursor: text; }
    html.vv-editing [${KEY_ATTR}]:hover { outline-style: solid; background-color: color-mix(in oklab, var(--color-gold) 22%, transparent); }
    html.vv-editing [${KEY_ATTR}].vv-selected { outline: 2.5px solid var(--color-royal); }
    html.vv-editing img[data-vv-img] { outline: 2px dashed color-mix(in oklab, var(--color-royal) 70%, transparent); outline-offset: 2px; cursor: pointer; }
    html.vv-editing img[data-vv-img]:hover { outline-style: solid; filter: brightness(1.05); }
    html.vv-editing img[data-vv-img].vv-selected { outline: 3px solid var(--color-royal); }
    html.vv-editing [data-pid], html.vv-editing [data-vv-section] { position: relative; }
    html.vv-editing [data-pid]:hover::after, html.vv-editing [data-vv-section]:hover::after {
      content: attr(data-vv-chip); position: absolute; top: 8px; right: 8px; z-index: 50; pointer-events: none;
      padding: 4px 10px; border-radius: 999px; background: var(--color-royal); color: #fff; font: 700 12px/1.4 system-ui, sans-serif;
      box-shadow: 0 4px 14px rgb(0 0 0 / .18);
    }
    html.vv-styling :is(${blockSel}) { cursor: pointer; }
    html.vv-styling :is(${blockSel}):hover { outline: 2px dashed color-mix(in oklab, var(--color-royal) 75%, transparent); outline-offset: -2px; }
    html.vv-styling .vv-block-selected { outline: 3px solid var(--color-gulal) !important; outline-offset: -3px; }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add("vv-editing");

  const markText = (t: Text) => {
    const v = t.nodeValue;
    if (!v || !v.includes("\u2062")) return;
    let key: string | null = null;
    const clean = v.replace(TAG_RE, (_m, body: string) => {
      key ??= decodeTag(body);
      return "";
    });
    t.nodeValue = clean;
    const el = t.parentElement;
    if (!key || !el) return;
    el.setAttribute(KEY_ATTR, key);
    let set = nodes.get(key);
    if (!set) nodes.set(key, (set = new Set()));
    set.add(t);
  };

  const markAttrs = (el: Element) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v || !v.includes("\u2062")) continue;
      let key: string | null = null;
      el.setAttribute(a, v.replace(TAG_RE, (_m, body: string) => ((key ??= decodeTag(body)), "")));
      // Only visible ones (search box hints) become editable; aria-labels just get cleaned.
      if (key && a === "placeholder") el.setAttribute(KEY_ATTR, key);
    }
  };

  const scan = (root: Node = document.body) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) markText(walker.currentNode as Text);
    if (root instanceof Element) {
      markAttrs(root);
      root.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach(markAttrs);
    }
    document.title = document.title.replace(TAG_RE, "");
    // Chips on products / banner / menu so the admin knows where tapping goes.
    document.querySelectorAll("[data-pid]:not([data-vv-chip])").forEach((el) => el.setAttribute("data-vv-chip", "Edit product"));
    document.querySelectorAll("[data-vv-section]:not([data-vv-chip])").forEach((el) => el.setAttribute("data-vv-chip", el.getAttribute("data-vv-label") ?? "Edit"));
    if (location.href !== lastHref) {
      lastHref = location.href;
      post({ type: "vv:ready", path: location.pathname + location.search });
    }
  };

  let queued = 0;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      scan();
    });
  });
  scan();
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

  // Tapping in edit mode edits instead of following links.
  document.addEventListener(
    "click",
    (e) => {
      if (mode === "style") {
        const el = (e.target as Element | null)?.closest(blockSel);
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        const key = blockOf(el);
        if (!key) return;
        selectBlock(key);
        post({ type: "vv:block", key, count: document.querySelectorAll(BLOCKS[key].selector).length, colors: colorsOf(el) });
        return;
      }
      if (mode !== "edit") return;
      const target = e.target as Element | null;
      const textEl = target?.closest(`[${KEY_ATTR}]`);
      const img = target?.closest("img[data-vv-img]");
      const product = target?.closest("[data-pid]");
      const section = target?.closest("[data-vv-section]");
      if (!textEl && !img && !product && !section) return;
      e.preventDefault();
      e.stopPropagation();
      if (textEl && (!product || product.contains(textEl))) {
        document.querySelectorAll(".vv-selected").forEach((x) => x.classList.remove("vv-selected"));
        textEl.classList.add("vv-selected");
        post({ type: "vv:edit", key: textEl.getAttribute(KEY_ATTR) });
      } else if (img) {
        document.querySelectorAll(".vv-selected").forEach((x) => x.classList.remove("vv-selected"));
        img.classList.add("vv-selected");
        post({ type: "vv:image", key: img.getAttribute("data-vv-img") });
      } else if (product) post({ type: "vv:open", href: `/admin/products/${product.getAttribute("data-pid")}` });
      else if (section) post({ type: "vv:open", href: section.getAttribute("data-vv-section") });
    },
    true,
  );

  window.addEventListener("message", (e: MessageEvent<Msg>) => {
    if (e.source !== window.parent) return;
    // The editor runs on this site or on its admin subdomain.
    const host = location.hostname.replace(/^www\./, "");
    const ok = e.origin === location.origin || new URL(e.origin).hostname.endsWith(`.${host}`);
    if (!ok || !e.data || typeof e.data !== "object") return;
    parentOrigin = e.origin;
    const m = e.data;
    if (m.type === "vv:mode") {
      mode = m.mode;
      document.documentElement.classList.toggle("vv-editing", mode === "edit");
      document.documentElement.classList.toggle("vv-styling", mode === "style");
      if (mode !== "style") selectBlock(null);
      post({ type: "vv:ready", path: location.pathname + location.search });
    } else if (m.type === "vv:design") {
      // The editor's unsaved design replaces the saved one (the server's <style id="vv-design">) while editing.
      const saved = document.getElementById("vv-design") as HTMLStyleElement | null;
      if (saved) saved.media = "not all";
      let live = document.getElementById("vv-design-live") as HTMLStyleElement | null;
      if (!live) {
        live = document.createElement("style");
        live.id = "vv-design-live";
        document.head.appendChild(live);
      }
      live.textContent = m.css;
      if (m.fonts && /^https:\/\/fonts\.googleapis\.com\//.test(m.fonts)) {
        let link = document.getElementById("vv-design-fonts") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.id = "vv-design-fonts";
          link.rel = "stylesheet";
          document.head.appendChild(link);
        }
        if (link.href !== m.fonts) link.href = m.fonts;
      }
    } else if (m.type === "vv:tokens") {
      // Resolve each colour through a hidden probe (tokens can be var() / color-mix chains).
      const probe = document.createElement("span");
      probe.style.display = "none";
      document.body.appendChild(probe);
      const colors = Object.fromEntries(
        COLOR_ROLES.map((r) => {
          probe.style.color = `var(--color-${r.token})`;
          return [r.token, toHex(getComputedStyle(probe).color)];
        }),
      );
      probe.remove();
      post({ type: "vv:tokens", colors });
    } else if (m.type === "vv:selectBlock") {
      const key = m.key && m.key in BLOCKS ? (m.key as BlockKey) : null;
      selectBlock(key);
      // Picked from the editor's lists: show it, and tell the editor its colours and how many there are.
      const el = key ? document.querySelector(BLOCKS[key].selector) : null;
      if (key && el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        post({ type: "vv:blockInfo", key, count: document.querySelectorAll(BLOCKS[key].selector).length, colors: colorsOf(el) });
      }
    } else if (m.type === "vv:set") {
      // Words with {placeholders} need the server to fill them in; the editor reloads the page for those.
      if (/\{\w+\}/.test(m.value)) return;
      for (const t of nodes.get(m.key) ?? []) if (t.isConnected) t.nodeValue = m.value;
      document.querySelectorAll(`[${KEY_ATTR}="${CSS.escape(m.key)}"][placeholder]`).forEach((el) => el.setAttribute("placeholder", m.value));
    } else if (m.type === "vv:img") {
      if (!/^(\/(?!\/)|https:\/\/)/.test(m.src)) return;
      document.querySelectorAll<HTMLImageElement>(`img[data-vv-img="${CSS.escape(m.key)}"]`).forEach((el) => {
        el.removeAttribute("srcset");
        el.src = m.src;
      });
    } else if (m.type === "vv:select") {
      document.querySelectorAll(".vv-selected").forEach((x) => x.classList.remove("vv-selected"));
      if (m.key) document.querySelector(`[${KEY_ATTR}="${CSS.escape(m.key)}"], img[data-vv-img="${CSS.escape(m.key)}"]`)?.classList.add("vv-selected");
    }
  });

  function selectBlock(key: BlockKey | null) {
    document.querySelectorAll(".vv-block-selected").forEach((x) => x.classList.remove("vv-block-selected"));
    if (key) document.querySelectorAll(BLOCKS[key].selector).forEach((x) => x.classList.add("vv-block-selected"));
  }
}

/** The colours a part of the page shows right now (its own background or the one behind it), as #rrggbb. */
function colorsOf(el: Element) {
  let bgEl: Element | null = el;
  let bg = "";
  while (bgEl && !bg) {
    const c = getComputedStyle(bgEl).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) bg = c;
    bgEl = bgEl.parentElement;
  }
  const heading = el.querySelector("h1,h2,h3,.font-display");
  const text = el.querySelector("p") ?? el;
  return { bg: toHex(bg || "#ffffff"), text: toHex(getComputedStyle(text).color), heading: toHex(heading ? getComputedStyle(heading).color : getComputedStyle(el).color) };
}

let ctx: CanvasRenderingContext2D | null = null;
/** Any CSS colour (oklch, color-mix…) → #rrggbb, by painting one pixel. */
function toHex(css: string) {
  ctx ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  if (!ctx || !css.trim()) return "#000000";
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css.trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
