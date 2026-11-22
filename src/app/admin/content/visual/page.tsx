"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Monitor, MousePointerClick, Pencil, RotateCcw, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, PageLoader, Spinner } from "@/components/ui";
import { CONTENT_GROUPS } from "@/content/defaults";
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
  return <Editor saved={data.content ?? {}} pages={pages} />;
}

function Editor({ saved, pages }: { saved: Record<string, string>; pages: { path: string; label: string }[] }) {
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
  const [mode, setMode] = useState<"edit" | "browse">("edit");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const current = useMemo(() => clean(edits), [edits]);
  const draftJson = JSON.stringify(current);
  const unsaved = draftJson !== base;
  const changedCount = Object.keys(current).length;

  const storeOrigin = useMemo(() => {
    try {
      return new URL(storeHref("/"), window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  }, []);
  const send = useCallback((msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(msg, storeOrigin), [storeOrigin]);

  // Messages from the framed store page.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== storeOrigin || !e.data || typeof e.data !== "object") return;
      const m = e.data as { type: string; key?: string; href?: string; path?: string };
      if (m.type === "vv:ready") {
        setLoading(false);
        if (m.path) setShownPath(m.path);
        send({ type: "vv:mode", mode });
      } else if (m.type === "vv:edit" && m.key && BY_KEY.has(m.key)) setSelected(m.key);
      else if (m.type === "vv:open" && m.href?.startsWith("/admin/")) window.open(m.href, "_blank", "noopener");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mode, send, storeOrigin]);

  useEffect(() => send({ type: "vv:mode", mode }), [mode, send]);
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

  const save = useMutation(
    trpc.admin.saveContent.mutationOptions({
      onSuccess: () => {
        setBase(draftJson);
        qc.invalidateQueries({ queryKey: trpc.admin.siteConfig.queryKey() });
        toast("Saved. Shoppers see the new text now.");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  const discard = () => {
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

  const field = selected ? BY_KEY.get(selected) : null;
  const value = field ? (edits[field.key] ?? field.value) : "";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
        <Link href="/admin/content" className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-bold text-ink-soft hover:text-royal">
          <ArrowLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Store text</span>
        </Link>
        <select value={pages.some((p) => p.path === path) ? path : ""} onChange={(e) => e.target.value && go(e.target.value)} className="h-9 min-w-0 rounded-full border border-line bg-paper px-3 text-base sm:text-sm" aria-label="Page to edit">
          {!pages.some((p) => p.path === path) && <option value="">{shownPath}</option>}
          {pages.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex rounded-full bg-sky p-0.5" role="radiogroup" aria-label="What tapping does">
          {(
            [
              ["edit", "Edit text", Pencil],
              ["browse", "Browse", MousePointerClick],
            ] as const
          ).map(([v, l, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold", mode === v ? "bg-paper text-ink shadow-lift" : "text-ink-soft")}>
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
          <Button size="sm" disabled={!unsaved || save.isPending} onClick={() => save.mutate({ content: current })}>
            {save.isPending ? <Spinner /> : "Save"}
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* The store */}
        <Frame device={device} frameKey={frameKey} path={path} frame={frame} loading={loading} onLoad={() => setLoading(false)} />

        {/* Editing panel: a side panel on wide screens, a sheet from the bottom on phones */}
        <aside
          className={cn(
            "z-10 flex flex-col border-line bg-paper",
            "max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[60%] max-lg:rounded-t-3xl max-lg:border-t max-lg:shadow-float max-lg:pb-[env(safe-area-inset-bottom,0px)]",
            "lg:w-[380px] lg:shrink-0 lg:border-l",
            !field && "max-lg:hidden",
          )}
        >
          {field ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold tracking-[0.06em] text-ink-mute uppercase">{field.groupLabel}</p>
                  <p className="font-bold">{field.label}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sky" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>
              <textarea
                autoFocus
                value={value}
                onChange={(e) => setValue(field.key, e.target.value)}
                rows={Math.min(8, Math.max(2, Math.ceil(value.length / 34)))}
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
              <Button size="sm" variant="outline" className="mt-4 self-start" onClick={() => setSelected(null)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="hidden flex-1 overflow-y-auto p-4 lg:block">
              <p className="font-bold">How it works</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
                <li>Every text you can change has a dotted outline. Tap it to edit it here.</li>
                <li>It changes in the page as you type. Nothing changes for shoppers until you press Save.</li>
                <li>Tap a product to edit it, or the banner, ribbon or Shop menu to open their own editors.</li>
                <li>Switch to Browse to follow links and visit other pages.</li>
              </ol>
              <p className="mt-6 font-bold">Changed ({changedCount})</p>
              <ul className="mt-2 space-y-1">
                {Object.keys(current).map((k) => (
                  <li key={k}>
                    <button type="button" onClick={() => setSelected(k)} className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sky">
                      <span className="block font-bold">{BY_KEY.get(k)?.label}</span>
                      <span className="block truncate text-ink-soft">{current[k]}</span>
                    </button>
                  </li>
                ))}
                {changedCount === 0 && <li className="text-sm text-ink-mute">Nothing changed yet.</li>}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
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
    <div ref={box} className="relative min-w-0 flex-1 overflow-hidden bg-paper-2">
      <iframe
        key={frameKey}
        ref={frame}
        src={storeHref(path)}
        title="Store, editable"
        onLoad={onLoad}
        className={cn("absolute top-0 left-1/2 border-0 bg-paper", phone && size.w > 420 && "top-3 rounded-2xl shadow-float")}
        style={{ width: w, height: phone && size.w > 420 ? size.h - 24 : size.h / scale, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-paper-2/60">
          <Spinner className="size-10 text-gulal" label="Loading the page" />
        </div>
      )}
    </div>
  );
}
