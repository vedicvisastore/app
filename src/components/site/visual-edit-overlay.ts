/**
 * Runs inside the store page when an admin opens it in the visual editor (Admin → Store text → Visual editor).
 * Loaded on demand only in edit mode, so shoppers never download it.
 *
 * - Finds text tagged with its content key (src/lib/stega.ts), removes the invisible tag and marks the element.
 * - In edit mode, tapping marked text asks the editor (the parent window) to edit that key; tapping a product,
 *   the banner or the shop menu asks it to open the matching admin page.
 * - Applies edits the editor sends back straight into the page, so typing shows instantly.
 */
import { decodeTag, TAG_RE } from "@/lib/stega";

type Msg =
  | { type: "vv:mode"; mode: "edit" | "browse" }
  | { type: "vv:set"; key: string; value: string }
  | { type: "vv:select"; key: string | null };

const KEY_ATTR = "data-vv-key";
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

let started = false;

export function start() {
  if (started || window.parent === window) return;
  started = true;
  const nodes = new Map<string, Set<Text>>();
  let mode: "edit" | "browse" = "edit";
  let parentOrigin = "*";
  let lastHref = "";

  const post = (msg: Record<string, unknown>) => window.parent.postMessage(msg, parentOrigin);

  const style = document.createElement("style");
  style.textContent = `
    html.vv-editing [${KEY_ATTR}] { outline: 1.5px dashed color-mix(in oklab, var(--color-gulal) 65%, transparent); outline-offset: 2px; border-radius: 3px; cursor: text; }
    html.vv-editing [${KEY_ATTR}]:hover { outline-style: solid; background-color: color-mix(in oklab, var(--color-gold) 22%, transparent); }
    html.vv-editing [${KEY_ATTR}].vv-selected { outline: 2.5px solid var(--color-royal); }
    html.vv-editing [data-pid], html.vv-editing [data-vv-section] { position: relative; }
    html.vv-editing [data-pid]:hover::after, html.vv-editing [data-vv-section]:hover::after {
      content: attr(data-vv-chip); position: absolute; top: 8px; right: 8px; z-index: 50; pointer-events: none;
      padding: 4px 10px; border-radius: 999px; background: var(--color-royal); color: #fff; font: 700 12px/1.4 system-ui, sans-serif;
      box-shadow: 0 4px 14px rgb(0 0 0 / .18);
    }
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
      if (mode !== "edit") return;
      const target = e.target as Element | null;
      const textEl = target?.closest(`[${KEY_ATTR}]`);
      const product = target?.closest("[data-pid]");
      const section = target?.closest("[data-vv-section]");
      if (!textEl && !product && !section) return;
      e.preventDefault();
      e.stopPropagation();
      if (textEl && (!product || product.contains(textEl))) {
        document.querySelectorAll(".vv-selected").forEach((x) => x.classList.remove("vv-selected"));
        textEl.classList.add("vv-selected");
        post({ type: "vv:edit", key: textEl.getAttribute(KEY_ATTR) });
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
      post({ type: "vv:ready", path: location.pathname + location.search });
    } else if (m.type === "vv:set") {
      // Words with {placeholders} need the server to fill them in; the editor reloads the page for those.
      if (/\{\w+\}/.test(m.value)) return;
      for (const t of nodes.get(m.key) ?? []) if (t.isConnected) t.nodeValue = m.value;
      document.querySelectorAll(`[${KEY_ATTR}="${CSS.escape(m.key)}"][placeholder]`).forEach((el) => el.setAttribute("placeholder", m.value));
    } else if (m.type === "vv:select") {
      document.querySelectorAll(".vv-selected").forEach((x) => x.classList.remove("vv-selected"));
      if (m.key) document.querySelector(`[${KEY_ATTR}="${CSS.escape(m.key)}"]`)?.classList.add("vv-selected");
    }
  });
}
