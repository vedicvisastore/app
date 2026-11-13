"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  ExternalLink,
  RotateCcw,
  Search,
  Smartphone,
  Monitor,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { CONTENT_GROUPS } from "@/content/defaults";
import { useTRPC } from "@/lib/trpc/client";
import { cn, storeHref } from "@/lib/utils";
import { Card, PageHeader, useToast } from "../_ui";

type Field = { label: string; value: string; hint?: string };
const FIELDS = CONTENT_GROUPS.flatMap((g) =>
  Object.entries(g.fields as Record<string, Field>).map(([k, f]) => ({
    key: `${g.key}.${k}`,
    group: g.key,
    ...f,
  })),
);
/** Where each section of text appears, so the owner can open it and check. */
const WHERE: Record<string, string> = {
  nav: "/",
  home: "/",
  shop: "/shop",
  pages: "/deals",
  product: "/shop",
  footer: "/",
  about: "/about",
  cart: "/cart",
  login: "/login",
};
const DEFAULT = new Map(FIELDS.map((f) => [f.key, f.value]));

/** Overrides only: drop anything empty or equal to the original wording. */
function clean(edits: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(edits).filter(([k, v]) => v.trim() && v !== DEFAULT.get(k)),
  );
}

export default function ContentPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery(trpc.admin.siteConfig.queryOptions());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [group, setGroup] = useState<string>(CONTENT_GROUPS[0].key);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (data) setEdits(data.content ?? {});
  }, [data]);
  const saved = useMemo(() => clean(data?.content ?? {}), [data]);
  const current = useMemo(() => clean(edits), [edits]);
  const unsaved = FIELDS.filter(
    (f) => (current[f.key] ?? "") !== (saved[f.key] ?? ""),
  ).length;

  // ── Live preview: the store, framed beside the editor, showing the unsaved text ──
  const [preview, setPreview] = useState(false);
  const [sheet, setSheet] = useState(false); // phone/tablet: preview opens as a full-screen sheet
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [frameKey, setFrameKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const pushPreview = useMutation(trpc.admin.previewContent.mutationOptions());
  const showing = preview || sheet;
  const draftJson = JSON.stringify(current);
  const lastSent = useRef<string | null>(null);
  useEffect(() => {
    if (window.matchMedia("(min-width: 1280px)").matches) setPreview(true);
  }, []);
  useEffect(() => {
    if (!showing || !data || lastSent.current === draftJson) return;
    const t = setTimeout(() => {
      pushPreview.mutate(
        { content: JSON.parse(draftJson) },
        {
          onSuccess: () => {
            lastSent.current = draftJson;
            setPreviewError(null);
            setFrameKey((k) => k + 1);
          },
          onError: (e) => setPreviewError(e.message),
        },
      );
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, draftJson, data]);
  useEffect(() => {
    // Leaving the editor (or closing the tab) ends the preview, so the store stops showing draft text.
    const end = () => void fetch("/api/trpc/admin.endPreview", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
    };
  }, []);

  const save = useMutation(
    trpc.admin.saveContent.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.admin.siteConfig.queryKey() });
        toast("Saved. Shoppers see the new text now.");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  const search = q.trim().toLowerCase();
  const visible = search
    ? FIELDS.filter((f) =>
        `${f.label} ${f.value} ${edits[f.key] ?? ""}`
          .toLowerCase()
          .includes(search),
      )
    : FIELDS.filter((f) => f.group === group);
  const changedIn = (g: string) =>
    FIELDS.filter((f) => f.group === g && current[f.key]).length;
  const pagePath = WHERE[search ? (visible[0]?.group ?? group) : group] ?? "/";
  const side = !preview; // section list as a sidebar only when the preview isn't taking the space

  if (isLoading || !data) return <Spinner className="text-ink-mute" />;

  return (
    <div className="pb-24">
      <PageHeader
        title="Store text"
        description="Every sentence on the store, grouped by where it appears. Type in a box and the preview updates as you go. Nothing changes for shoppers until you save."
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="hidden xl:inline-flex"
              onClick={() => setPreview((v) => !v)}
            >
              {preview ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}{" "}
              {preview ? "Hide preview" : "Show preview"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="xl:hidden"
              onClick={() => setSheet(true)}
            >
              <Eye className="size-4" aria-hidden /> Preview
            </Button>
          </>
        }
      />

      <div
        className={cn(
          preview &&
            "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(24rem,30rem)] xl:gap-6",
        )}
      >
        <div
          className={cn(
            "grid gap-6",
            side && "lg:grid-cols-[15rem_minmax(0,1fr)]",
          )}
        >
          {/* Sections */}
          <aside className={cn(side && "lg:sticky lg:top-6 lg:self-start")}>
            <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-paper px-3 focus-within:border-royal">
              <Search className="size-4 text-ink-mute" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find any text"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                aria-label="Find any text"
              />
            </label>
            <nav
              className={cn(
                "no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4",
                side && "lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0",
              )}
              aria-label="Text sections"
            >
              {CONTENT_GROUPS.map((g) => {
                const active = !search && group === g.key;
                const n = changedIn(g.key);
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => {
                      setGroup(g.key);
                      setQ("");
                    }}
                    className={cn(
                      "flex shrink-0 items-center justify-between gap-3 rounded-full border px-4 py-2 text-left text-sm whitespace-nowrap",
                      side && "lg:rounded-xl lg:border-0 lg:px-3 lg:py-2.5",
                      active
                        ? cn(
                            "border-ink bg-ink text-white",
                            side &&
                              "lg:bg-paper lg:font-bold lg:text-royal lg:shadow-lift",
                          )
                        : cn(
                            "border-line text-ink-soft hover:text-ink",
                            side && "lg:hover:bg-sky/60",
                          ),
                    )}
                  >
                    {g.label}
                    {n > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-xs",
                          active
                            ? "bg-gold text-shyam"
                            : "bg-haldi-soft text-gold-ink",
                        )}
                      >
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Fields */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-soft">
                {search
                  ? `${visible.length} ${visible.length === 1 ? "match" : "matches"} for “${q}”`
                  : `${visible.length} lines in ${CONTENT_GROUPS.find((g) => g.key === group)?.label}`}
              </p>
              {!search && WHERE[group] && (
                <a
                  href={storeHref(WHERE[group])}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-royal"
                >
                  See it on the store{" "}
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              )}
            </div>
            <Card className="divide-y divide-line">
              {visible.map((f) => {
                const value = edits[f.key] ?? f.value;
                const changed = !!current[f.key];
                const long = f.value.length > 70;
                const setValue = (v: string) =>
                  setEdits((s) => ({ ...s, [f.key]: v }));
                return (
                  <div
                    key={f.key}
                    className={cn("p-4 sm:p-5", changed && "bg-haldi-soft/30")}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor={f.key} className="font-bold">
                        {f.label}
                        {search && (
                          <span className="ml-2 text-xs font-normal text-ink-mute">
                            {
                              CONTENT_GROUPS.find((g) => g.key === f.group)
                                ?.label
                            }
                          </span>
                        )}
                      </label>
                      {changed && (
                        <span className="flex items-center gap-2">
                          <span className="rounded-full bg-haldi-soft px-2 py-0.5 text-xs font-bold text-gold-ink">
                            Changed
                          </span>
                          <button
                            type="button"
                            onClick={() => setValue(f.value)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft hover:text-ink"
                          >
                            <RotateCcw className="size-3" aria-hidden /> Use
                            original
                          </button>
                        </span>
                      )}
                    </div>
                    {long ? (
                      <textarea
                        id={f.key}
                        rows={2}
                        maxLength={600}
                        className="field"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    ) : (
                      <input
                        id={f.key}
                        maxLength={600}
                        className="field"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    )}
                    {changed && (
                      <p className="mt-1.5 text-xs text-ink-mute">
                        Original: {f.value}
                      </p>
                    )}
                    {f.hint && (
                      <p className="mt-1.5 text-xs text-ink-soft">
                        Filled in automatically: {f.hint}. Keep the words in{" "}
                        {"{braces}"}.
                      </p>
                    )}
                  </div>
                );
              })}
              {visible.length === 0 && (
                <p className="p-8 text-center text-sm text-ink-mute">
                  No text matches.
                </p>
              )}
            </Card>
          </div>
        </div>

        {preview && (
          <aside className="hidden xl:block">
            <div className="sticky top-6">
              <PreviewPanel
                path={pagePath}
                device={device}
                setDevice={setDevice}
                frameKey={frameKey}
                error={previewError}
                updating={pushPreview.isPending}
              />
            </div>
          </aside>
        )}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] xl:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">Preview</p>
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="grid size-10 place-items-center rounded-full hover:bg-sky"
              aria-label="Close preview"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <PreviewPanel
              path={pagePath}
              device="phone"
              frameKey={frameKey}
              error={previewError}
              updating={pushPreview.isPending}
              fill
            />
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            {unsaved
              ? `${unsaved} unsaved ${unsaved === 1 ? "change" : "changes"}`
              : "All changes saved"}
          </p>
          <div className="flex gap-2">
            {unsaved > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEdits(data.content ?? {})}
              >
                Discard
              </Button>
            )}
            <Button
              size="sm"
              disabled={!unsaved || save.isPending}
              onClick={() => save.mutate({ content: current })}
            >
              {save.isPending ? <Spinner /> : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({
  path,
  device,
  setDevice,
  frameKey,
  error,
  updating,
  fill,
}: {
  path: string;
  device: "phone" | "desktop";
  setDevice?: (d: "phone" | "desktop") => void;
  frameKey: number;
  error: string | null;
  updating: boolean;
  fill?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  // Desktop: render the page at laptop width and shrink it to fit the panel.
  const frameW = device === "desktop" ? 1280 : Math.min(400, width);
  const scale = device === "desktop" ? width / 1280 : 1;
  const height = fill ? "100%" : "calc(100dvh - 9.5rem)";
  return (
    <div className={cn("flex flex-col", fill && "h-full")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <span
            className={cn(
              "size-2 rounded-full",
              error
                ? "bg-gulal"
                : updating
                  ? "animate-pulse bg-gold"
                  : "bg-mor",
            )}
            aria-hidden
          />
          {error ?? (updating ? "Updating…" : "Live preview")}
        </p>
        <div className="flex items-center gap-1">
          {setDevice && (
            <div
              className="flex rounded-full bg-sky p-0.5"
              role="radiogroup"
              aria-label="Preview size"
            >
              {(["phone", "desktop"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={device === d}
                  aria-label={d === "phone" ? "Phone" : "Laptop"}
                  onClick={() => setDevice(d)}
                  className={cn(
                    "grid size-8 place-items-center rounded-full",
                    device === d
                      ? "bg-paper text-ink shadow-lift"
                      : "text-ink-soft",
                  )}
                >
                  {d === "phone" ? (
                    <Smartphone className="size-4" />
                  ) : (
                    <Monitor className="size-4" />
                  )}
                </button>
              ))}
            </div>
          )}
          <a
            href={storeHref(path)}
            target="_blank"
            rel="noreferrer"
            className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sky"
            aria-label="Open in a new tab"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
      <div
        ref={box}
        className="relative overflow-hidden rounded-2xl border border-line bg-paper-2"
        style={{ height }}
      >
        <iframe
          key={`${path}-${frameKey}`}
          src={storeHref(path)}
          title="Store preview"
          className="absolute top-0 left-1/2 border-0 bg-paper"
          style={{
            width: frameW,
            height: `${100 / scale}%`,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
}
