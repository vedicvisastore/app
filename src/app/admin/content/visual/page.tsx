"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ImageUp, Monitor, MousePointerClick, Paintbrush, Pencil, RotateCcw, Search, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, PageLoader, Spinner } from "@/components/ui";
import { CONTENT_GROUPS } from "@/content/defaults";
import { DEFAULT_IMAGES, IMAGE_SLOTS, isImageKey, type ImageKey } from "@/content/images";
import { useUploadFile } from "../../_upload";
import { BlockPanel, DesignSection, DetailHeader, PartsList, ALL_FONTS_HREF, type PickedBlock } from "./design-panel";
import { SearchResults, buildIndex, TABS, type Tab } from "./editor-search";
import { BLOCKS, cleanDesign, designCss, designFontsHref, type BlockKey, type Design } from "@/lib/design";
import { useTRPC } from "@/lib/trpc/client";
import { cn, storeHref } from "@/lib/utils";
import { useToast } from "../../_ui";

type Field = { key: string; group: string; groupLabel: string; label: string; value: string; hint?: string };
const FIELDS: Field[] = CONTENT_GROUPS.flatMap((g) =>
  Object.entries(g.fields as Record<string, { label: string; value: string; hint?: string }>).map(([k, f]) => ({ key: `${g.key}.${k}`, group: g.key, groupLabel: g.label, ...f })),
);
const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

/** Overrides only: drop anything empty or equal to the original wording. */
const clean = (edits: Record<string, string>) => Object.fromEntries(Object.entries(edits).filter(([k, v]) => v.trim() && v !== BY_KEY.get(k)?.value));

const PAGES = [
  { path: "/", label: "Home" },
  { path: "/shop", label: "Shop" },
  { path: "/deals", label: "Deals" },
  { path: "/new", label: "New launches" },
  { path: "/cart", label: "Cart" },
  { path: "/checkout", label: "Checkout" },
  { path: "/track", label: "Track order" },
  { path: "/contact", label: "Contact" },
  { path: "/about", label: "About" },
  { path: "/shipping", label: "Shipping" },
  { path: "/login", label: "Log in" },
];

/**
 * Visual text editor: the real store in a frame, with every piece of editable text outlined. Tap text to edit it
 * here; it changes in the page as you type. Opens on its own page (from Store text) so the heavy frame only loads
 * when the owner asks for it.
 */
export default function VisualEditorPage() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.admin.siteConfig.queryOptions());
  const products = useQuery(trpc.catalog.list.queryOptions({}));
  const start = useMutation(trpc.admin.startVisualEdit.mutationOptions());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Edit mode is a cookie, so the framed store pages tag their text for this admin only.
    start.mutate(undefined, { onSettled: () => setReady(true) });
    const end = () => void fetch("/api/trpc/admin.endVisualEdit", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data || !ready) return <PageLoader label="Opening the visual editor" className="fixed inset-0 z-[60] bg-paper" />;
  const box = products.data?.find((p) => p.kind === "bundle");
  const item = products.data?.find((p) => p.kind === "single");
  const pages = [...PAGES.slice(0, 2), ...(box ? [{ path: `/p/${box.slug}`, label: "A box page" }] : []), ...(item ? [{ path: `/p/${item.slug}`, label: "An item page" }] : []), ...PAGES.slice(2)];
  return <Editor saved={data.content ?? {}} savedImages={data.images ?? {}} savedDesign={(data.design ?? {}) as Design} pages={pages} />;
}

const IMAGE_KEYS = Object.keys(IMAGE_SLOTS) as ImageKey[];
/** Saved picture overrides → full map (missing = the original picture). */
const fullImages = (over: Record<string, string>) => Object.fromEntries(IMAGE_KEYS.map((k) => [k, over[k] || DEFAULT_IMAGES[k]])) as Record<ImageKey, string>;

function Editor({ saved, savedImages, savedDesign, pages }: { saved: Record<string, string>; savedImages: Record<string, string>; savedDesign: Design; pages: { path: string; label: string }[] }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const frame = useRef<HTMLIFrameElement>(null);
  const [edits, setEdits] = useState<Record<string, string>>(saved);
  const [base, setBase] = useState(JSON.stringify(clean(saved)));
  const [path, setPath] = useState("/");
  const [shownPath, setShownPath] = useState("/");
  const [frameKey, setFrameKey] = useState(0);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [mode, setMode] = useState<"edit" | "style" | "browse">("edit");
  // Design (colours, fonts, look, block styles): what is saved and what the owner is trying.
  const [design, setDesign] = useState<Design>(() => cleanDesign(savedDesign));
  const [designBase, setDesignBase] = useState(() => JSON.stringify(cleanDesign(savedDesign)));
  const designJson = JSON.stringify(cleanDesign(design));
  const designChanged = designJson !== designBase;
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [block, setBlock] = useState<PickedBlock | null>(null);
  // No side panel: the preview fills the screen. A dock at the bottom opens one sheet at a time (Text, Pictures,
  // Colours, Fonts, Look, Parts, Search); picking something opens a small card right next to it on the page.
  const [sheet, setSheet] = useState<Tab | "search" | null>(null);
  const [group, setGroup] = useState<string>(CONTENT_GROUPS[0].key);
  const [focus, setFocus] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const current = useMemo(() => clean(edits), [edits]);
  const draftJson = JSON.stringify(current);
  const searchIndex = useMemo(() => buildIndex(FIELDS, edits), [edits]);
  // Pictures: what is saved, and what the owner has picked since.
  const [imgBase, setImgBase] = useState(() => fullImages(savedImages));
  const [imgs, setImgs] = useState(() => fullImages(savedImages));
  const imgsChanged = IMAGE_KEYS.filter((k) => imgs[k] !== imgBase[k]);
  const upload = useUploadFile();
  const [uploading, setUploading] = useState(false);
  const unsaved = draftJson !== base || imgsChanged.length > 0 || designChanged;

  const storeOrigin = useMemo(() => {
    try {
      return new URL(storeHref("/"), window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  }, []);
  const send = useCallback((msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(msg, storeOrigin), [storeOrigin]);
  const stage = useRef<HTMLDivElement>(null);
  /** An element's box inside the framed page → its box on the editor screen (the laptop preview is scaled). */
  const toPage = (r: Rect): Rect => {
    const f = frame.current?.getBoundingClientRect();
    const box = stage.current?.getBoundingClientRect();
    if (!f || !box || !frame.current) return r;
    const scale = f.width / (frame.current.offsetWidth || f.width);
    return { x: f.left - box.left + r.x * scale, y: f.top - box.top + r.y * scale, w: r.w * scale, h: r.h * scale, fl: f.left - box.left, fr: f.right - box.left };
  };
  // Ctrl/⌘ K opens search; Esc closes whatever is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSelected(null);
        setBlock(null);
        setSheet("search");
      } else if (e.key === "Escape") {
        setSheet(null);
        setSelected(null);
        setBlock(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Messages from the framed store page.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== storeOrigin || !e.data || typeof e.data !== "object") return;
      const m = e.data as { type: string; key?: string; href?: string; path?: string; count?: number; colors?: Record<string, string>; rect?: Rect };
      if (m.rect) setAnchor(toPage(m.rect));
      if (m.type === "vv:ready") {
        setLoading(false);
        if (m.path) setShownPath(m.path);
        send({ type: "vv:mode", mode });
        send({ type: "vv:design", css: designCss(designRef.current), fonts: designFontsHref(designRef.current) });
        send({ type: "vv:tokens" });
        // A part picked from a list on another page: point at it once that page has loaded.
        if (blockRef.current) send({ type: "vv:selectBlock", key: blockRef.current.key });
        // Unsaved pictures aren't on the server yet: put them back into every page that loads.
        for (const k of imgsChangedRef.current) send({ type: "vv:img", key: k, src: imgsRef.current[k] });
      } else if ((m.type === "vv:edit" && m.key && BY_KEY.has(m.key)) || (m.type === "vv:image" && m.key && isImageKey(m.key))) {
        setBlock(null);
        setSelected(m.key!);
        setSheet(null);
      }
      else if (m.type === "vv:open" && m.href?.startsWith("/admin/")) window.open(m.href, "_blank", "noopener");
      else if (m.type === "vv:tokens" && m.colors) setTokens(m.colors);
      else if (m.type === "vv:blockInfo" && m.key) setBlock((b) => (b && b.key === m.key ? { ...b, count: m.count ?? null, colors: (m.colors ?? {}) as PickedBlock["colors"] } : b));
      else if (m.type === "vv:block" && m.key) {
        setSelected(null);
        setBlock({ key: m.key as PickedBlock["key"], count: m.count ?? null, colors: (m.colors ?? {}) as PickedBlock["colors"] });
        setSheet(null);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mode, send, storeOrigin]);

  const imgsRef = useRef(imgs);
  const imgsChangedRef = useRef(imgsChanged);
  imgsRef.current = imgs;
  imgsChangedRef.current = imgsChanged;
  const designRef = useRef(design);
  designRef.current = design;
  const blockRef = useRef(block);
  blockRef.current = block;
  useEffect(() => send({ type: "vv:mode", mode }), [mode, send]);
  // Every design change is shown in the frame straight away.
  useEffect(() => send({ type: "vv:design", css: designCss(design), fonts: designFontsHref(design) }), [designJson, send]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loading) send({ type: "vv:selectBlock", key: block?.key ?? null });
  }, [block?.key, send]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => send({ type: "vv:select", key: selected }), [selected, send]);

  // Unsaved text goes to the server as a short-lived admin-only draft, so page changes inside the frame keep it.
  const pushPreview = useMutation(trpc.admin.previewContent.mutationOptions());
  const needsReload = useRef(false);
  const lastSent = useRef(JSON.stringify(clean(saved)));
  useEffect(() => {
    if (lastSent.current === draftJson) return;
    const t = setTimeout(() => {
      pushPreview.mutate(
        { content: JSON.parse(draftJson) },
        {
          onSuccess: () => {
            lastSent.current = draftJson;
            if (needsReload.current) {
              needsReload.current = false;
              setLoading(true);
              setFrameKey((k) => k + 1);
            }
          },
          onError: (e) => toast(e.message, "error"),
        },
      );
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftJson]);

  const setValue = (key: string, value: string) => {
    setEdits((x) => ({ ...x, [key]: value }));
    const shown = value.trim() ? value : (BY_KEY.get(key)?.value ?? "");
    if (/\{\w+\}/.test(shown)) needsReload.current = true; // the server fills in {placeholders}
    else send({ type: "vv:set", key, value: shown });
  };

  const saveText = useMutation(trpc.admin.saveContent.mutationOptions());
  const saveImgs = useMutation(trpc.admin.saveImages.mutationOptions());
  const saveDesignM = useMutation(trpc.admin.saveDesign.mutationOptions());
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      // Text and pictures live in the same file: save one after the other, never at the same time.
      if (draftJson !== base) await saveText.mutateAsync({ content: current });
      if (imgsChanged.length) await saveImgs.mutateAsync({ images: Object.fromEntries(IMAGE_KEYS.map((k) => [k, imgs[k]])) });
      if (designChanged) await saveDesignM.mutateAsync({ design: JSON.parse(designJson) });
      setBase(draftJson);
      setImgBase(imgs);
      setDesignBase(designJson);
      qc.invalidateQueries({ queryKey: trpc.admin.siteConfig.queryKey() });
      toast("Saved. Shoppers see the changes now.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const setImage = (key: ImageKey, src: string) => {
    setImgs((x) => ({ ...x, [key]: src }));
    send({ type: "vv:img", key, src });
  };
  const pickFile = async (key: ImageKey, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose a picture (JPG, PNG or WebP).", "error");
    setUploading(true);
    try {
      setImage(key, await upload(file));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const discard = () => {
    setDesign(JSON.parse(designBase) as Design);
    setBlock(null);
    for (const k of imgsChanged) send({ type: "vv:img", key: k, src: imgBase[k] });
    setImgs(imgBase);
    const back = JSON.parse(base) as Record<string, string>;
    setEdits(back);
    setSelected(null);
    needsReload.current = true;
    // Reload with the saved text once the draft is reset on the server.
    pushPreview.mutate({ content: back }, { onSuccess: () => { lastSent.current = JSON.stringify(back); setLoading(true); setFrameKey((k) => k + 1); } });
  };

  const go = (p: string) => {
    setPath(p);
    setLoading(true);
    setFrameKey((k) => k + 1);
  };

  /** Open a part's style panel and show it in the preview, going to a page where it appears if needed. */
  const goToPart = (key: BlockKey) => {
    const want = (BLOCKS[key] as { page?: string }).page;
    const target = want === "product" ? pages.find((p) => p.path.startsWith("/p/"))?.path : want;
    setSelected(null);
    setMode("style");
    setSheet(null);
    setAnchor(null);
    const here = shownPath.split("?")[0];
    const elsewhere = !!target && !(want === "product" ? here.startsWith("/p/") : here === target);
    // One jump, no animation: on another page the part is shown once that page has loaded (vv:ready);
    // on this page the block effect sends it. Only re-send when the same part is picked again.
    if (elsewhere) go(target!);
    else if (block?.key === key) send({ type: "vv:selectBlock", key });
    setBlock({ key, count: null, colors: {} });
  };

  const field = selected ? BY_KEY.get(selected) : null;
  const slotKey = selected && isImageKey(selected) ? selected : null;
  const value = field ? (edits[field.key] ?? field.value) : "";
  const detail = !!(block || field || slotKey);
  const closeDetail = () => {
    setBlock(null);
    setSelected(null);
    setAnchor(null);
  };
  const openFromList = (key: string) => {
    setSheet(null);
    setAnchor(null);
    setSelected(key);
  };
  const sheetTitle = sheet === "search" ? "Search" : TABS.find((t) => t.key === sheet)?.label;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-3 py-2 sm:px-4">
        <Link href="/admin/content" className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-bold text-ink-soft hover:text-royal">
          <ArrowLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Back</span>
        </Link>
        <select value={pages.some((p) => p.path === path) ? path : ""} onChange={(e) => e.target.value && go(e.target.value)} className="h-9 min-w-0 rounded-full border border-line bg-paper px-3 text-base sm:text-sm" aria-label="Page to edit">
          {!pages.some((p) => p.path === path) && <option value="">{shownPath}</option>}
          {pages.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex rounded-full bg-sky p-0.5" role="radiogroup" aria-label="What tapping the page does">
          {(
            [
              ["edit", "Text", Pencil],
              ["style", "Style", Paintbrush],
              ["browse", "Browse", MousePointerClick],
            ] as const
          ).map(([v, l, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => { setMode(v); if (v !== "style") setBlock(null); }} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold", mode === v ? "bg-paper text-ink shadow-lift" : "text-ink-soft")}>
              <Icon className="size-3.5" aria-hidden /> {l}
            </button>
          ))}
        </div>
        <div className="hidden rounded-full bg-sky p-0.5 md:flex" role="radiogroup" aria-label="Preview size">
          {(
            [
              ["phone", Smartphone, "Phone"],
              ["desktop", Monitor, "Laptop"],
            ] as const
          ).map(([v, Icon, l]) => (
            <button key={v} type="button" role="radio" aria-checked={device === v} aria-label={l} onClick={() => setDevice(v)} className={cn("grid size-8 place-items-center rounded-full", device === v ? "bg-paper text-ink shadow-lift" : "text-ink-soft")}>
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
        <a href={storeHref(shownPath)} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-1 rounded-full px-2 text-sm text-ink-soft hover:text-royal sm:inline-flex">
          <ExternalLink className="size-4" aria-hidden /> Open
        </a>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-ink-soft lg:inline">{unsaved ? "Unsaved changes" : "All saved"}</span>
          {unsaved && (
            <Button size="sm" variant="ghost" onClick={discard}>
              Discard
            </Button>
          )}
          <Button size="sm" disabled={!unsaved || saving || uploading} onClick={save}>
            {saving ? <Spinner /> : "Save"}
          </Button>
        </div>
      </div>

      {/* Font samples need the fonts themselves (admin page only). */}
      <link rel="stylesheet" href={ALL_FONTS_HREF} />
      <div ref={stage} className="relative min-h-0 flex-1">
        <Frame device={device} frameKey={frameKey} path={path} frame={frame} loading={loading} onLoad={() => setLoading(false)} />

        {/* Click outside a sheet or card (on the dimmed page) to close it */}
        {(sheet || detail) && <button type="button" aria-label="Close" onClick={() => { setSheet(null); closeDetail(); }} className={cn("absolute inset-0 z-20 cursor-default", sheet ? "bg-ink/15" : "bg-transparent")} />}

        {/* A dock item's sheet: rises above the dock, roomy, one at a time */}
        {sheet && (
          <Sheet title={sheetTitle ?? ""} wide={sheet === "fonts" || sheet === "pictures" || sheet === "colours"} onClose={() => setSheet(null)}>
            {sheet === "search" ? (
              <>
                <label className="mb-3 flex h-12 items-center gap-2 rounded-2xl border border-line bg-paper-2 px-4 focus-within:border-royal">
                  <Search className="size-4 shrink-0 text-ink-mute" aria-hidden />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Text, colours, fonts, parts… (typos are fine)" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" aria-label="Search the editor" />
                </label>
                {q.trim() ? (
                  <SearchResults
                    items={searchIndex}
                    q={q}
                    onPick={(it) => {
                      setQ("");
                      if (it.kind === "text" || it.kind === "picture") openFromList(it.key);
                      else if (it.kind === "part") goToPart(it.key as BlockKey);
                      else {
                        setSheet(it.kind);
                        setFocus(`${it.key}:${Date.now()}`);
                      }
                    }}
                  />
                ) : (
                  <p className="py-6 text-center text-sm text-ink-mute">Find any text, picture, colour, font or part of the store.</p>
                )}
              </>
            ) : sheet === "text" ? (
              <>
                <div className="no-scrollbar -mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5">
                  {CONTENT_GROUPS.map((g) => {
                    const n = FIELDS.filter((f) => f.group === g.key && current[f.key]).length;
                    return (
                      <button key={g.key} type="button" onClick={() => setGroup(g.key)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap", group === g.key ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:border-ink")}>
                        {g.label}
                        {n > 0 && <span className="ml-1 text-gulal">•{n}</span>}
                      </button>
                    );
                  })}
                </div>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {FIELDS.filter((f) => f.group === group).map((f) => (
                    <li key={f.key}>
                      <button type="button" onClick={() => openFromList(f.key)} className="w-full rounded-xl px-3 py-2 text-left hover:bg-sky">
                        <span className="flex items-center gap-1.5 text-[11px] text-ink-mute">
                          {f.label}
                          {current[f.key] && <span className="size-1.5 rounded-full bg-gulal" aria-label="Changed" />}
                        </span>
                        <span className="block truncate text-sm">{edits[f.key] || f.value}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : sheet === "pictures" ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {IMAGE_KEYS.map((k) => (
                  <li key={k}>
                    <button type="button" onClick={() => openFromList(k)} className="w-full rounded-2xl border border-line p-2 text-left hover:border-royal">
                      <span className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-paper-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgs[k]} alt="" className="max-h-full max-w-full object-contain" />
                      </span>
                      <span className="mt-1.5 block truncate text-sm font-bold">
                        {IMAGE_SLOTS[k].label}
                        {imgsChanged.includes(k) && <span className="ml-1 text-gulal">•</span>}
                      </span>
                      <span className="block truncate text-xs text-ink-mute">{IMAGE_SLOTS[k].where}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : sheet === "parts" ? (
              <PartsList design={design} onPick={goToPart} />
            ) : (
              <DesignSection part={sheet} design={design} setDesign={setDesign} tokens={tokens} focus={focus?.split(":")[0] ?? null} onPart={goToPart} />
            )}
          </Sheet>
        )}

        {/* What was picked: a card beside it on the page (or a sheet on small screens) */}
        {detail && (
          <Floating anchor={anchor} onClose={closeDetail}>
            {block ? (
              <BlockPanel block={block} design={design} setDesign={setDesign} onClose={closeDetail} />
            ) : slotKey ? (
              <div className="p-4">
                <DetailHeader eyebrow={`Picture · ${IMAGE_SLOTS[slotKey].where}`} title={IMAGE_SLOTS[slotKey].label} onBack={closeDetail} />
                <div className="grid place-items-center rounded-xl bg-paper-2 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgs[slotKey]} alt="" className="max-h-48 w-auto max-w-full rounded-lg object-contain" />
                </div>
                <p className="mt-2 text-xs text-ink-soft">{IMAGE_SLOTS[slotKey].hint} Up to 10 MB.</p>
                <label className={cn("mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-gold px-5 text-sm font-bold text-shyam hover:brightness-95", uploading && "pointer-events-none opacity-60")}>
                  {uploading ? <Spinner /> : <ImageUp className="size-4" aria-hidden />} {uploading ? "Uploading…" : "Upload a new picture"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => { void pickFile(slotKey, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {imgs[slotKey] !== DEFAULT_IMAGES[slotKey] && (
                  <button type="button" onClick={() => setImage(slotKey, DEFAULT_IMAGES[slotKey])} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-royal">
                    <RotateCcw className="size-3.5" aria-hidden /> Use the original picture
                  </button>
                )}
              </div>
            ) : field ? (
              <div className="p-4">
                <DetailHeader eyebrow={field.groupLabel} title={field.label} onBack={closeDetail} />
                <textarea
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  rows={Math.min(7, Math.max(2, Math.ceil(value.length / 34)))}
                  maxLength={600}
                  className="field text-base"
                  aria-label={field.label}
                />
                {field.hint && <p className="mt-2 text-xs text-ink-soft">{field.hint}</p>}
                {/\{\w+\}/.test(field.value) && !field.hint && <p className="mt-2 text-xs text-ink-soft">Keep the words in {"{braces}"}: the store fills them in.</p>}
                {value !== field.value && (
                  <div className="mt-3 rounded-xl bg-paper-2 p-3 text-sm">
                    <p className="text-xs text-ink-mute">Original</p>
                    <p className="text-ink-soft">{field.value}</p>
                    <button type="button" onClick={() => setValue(field.key, field.value)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-royal">
                      <RotateCcw className="size-3.5" aria-hidden /> Use original
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </Floating>
        )}

        {/* The dock: everything the editor can change, always one tap away */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex justify-center px-3">
          <nav className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-ink/92 p-1.5 text-white shadow-float backdrop-blur no-scrollbar" aria-label="Editor">
            <DockBtn active={sheet === "search"} onClick={() => { closeDetail(); setSheet((s) => (s === "search" ? null : "search")); }} icon={Search} label="Search" />
            <span className="mx-1 h-6 w-px shrink-0 bg-white/20" aria-hidden />
            {TABS.map((t) => (
              <DockBtn key={t.key} active={sheet === t.key} onClick={() => { closeDetail(); setSheet((s) => (s === t.key ? null : t.key)); }} icon={t.icon} label={t.label} />
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

/** Box of the picked element on the editor screen; fl/fr = left and right edges of the preview frame. */
type Rect = { x: number; y: number; w: number; h: number; fl?: number; fr?: number };

function DockBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Search; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold transition-colors", active ? "bg-paper text-ink" : "text-white/85 hover:bg-white/10 hover:text-white")}>
      <Icon className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** A dock item's content: a roomy card rising above the dock (a full-width sheet on phones). */
function Sheet({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className={cn("absolute bottom-[76px] left-1/2 z-30 flex max-h-[min(72vh,720px)] -translate-x-1/2 flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-float", wide ? "w-[min(820px,96vw)]" : "w-[min(600px,96vw)]")} aria-label={title}>
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="font-display text-xl">{title}</p>
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sky" aria-label="Close">
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * The card for what was picked, placed beside it on the page so you can see the change while you make it.
 * Falls back to a sheet above the dock when there's no room (phones) or no place on this page.
 */
function Floating({ anchor, children }: { anchor: Rect | null; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const box = ref.current?.parentElement?.getBoundingClientRect();
    const card = ref.current?.getBoundingClientRect();
    if (!anchor || !box || !card || box.width < 760) return setPos(null);
    const W = card.width;
    const gap = 16;
    const fits = (x: number) => x >= 12 && x + W <= box.width - 12;
    // Beside the preview frame if there's room (nothing covered), else beside the element itself.
    const options = [(anchor.fr ?? Infinity) + gap, (anchor.fl ?? -Infinity) - W - gap, anchor.x + anchor.w + gap, anchor.x - W - gap];
    const left = options.find(fits) ?? Math.max(12, box.width - W - 12);
    const top = Math.min(Math.max(12, anchor.y), Math.max(12, box.height - card.height - 90));
    setPos({ left, top });
  }, [anchor]);
  return (
    <section
      ref={ref}
      className={cn(
        "absolute z-30 max-h-[min(70vh,600px)] w-[min(380px,96vw)] overflow-y-auto rounded-3xl border border-line bg-paper shadow-float",
        !pos && "bottom-[76px] left-1/2 -translate-x-1/2",
      )}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
    >
      {children}
    </section>
  );
}

function Frame({ device, frameKey, path, frame, loading, onLoad }: { device: "phone" | "desktop"; frameKey: number; path: string; frame: React.RefObject<HTMLIFrameElement | null>; loading: boolean; onLoad: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 800 });
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  // Phone: a real phone width (full width on an actual phone). Laptop: 1280px wide, shrunk to fit.
  const phone = device === "phone" || size.w < 700;
  const w = phone ? Math.min(400, size.w) : 1280;
  const scale = phone ? 1 : Math.min(1, size.w / 1280);
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-paper-2">
      <iframe
        key={frameKey}
        ref={frame}
        src={storeHref(path)}
        title="Store, editable"
        onLoad={onLoad}
        className={cn("absolute top-0 left-1/2 border-0 bg-paper", phone && size.w > 420 && "top-3 rounded-2xl shadow-float")}
        style={{ width: w, height: phone && size.w > 420 ? size.h - 96 : (size.h - 72) / scale, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-paper-2/60">
          <Spinner className="size-10 text-gulal" label="Loading the page" />
        </div>
      )}
    </div>
  );
}
