"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ImagePlus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";
import { Button, Spinner , PageLoader } from "@/components/ui";
import type { FestivalAccent } from "@/db/schema";
import { ACCENT_BAND, ACCENT_LABEL, festivalDay } from "@/lib/festival-accent";
import { FESTIVAL_STATE_LABEL, festivalState } from "@/lib/festival-status";
import { useTRPC } from "@/lib/trpc/client";
import { cn, inr, slugify, storeHref } from "@/lib/utils";
import { Card, ConfirmButton, Field, Toggle, useToast } from "../../_ui";
import { useUploadFile } from "../../_upload";

const ACCENTS: FestivalAccent[] = ["gulal", "gold", "royal", "peacock", "mor"];

type Draft = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  festivalDate: string;
  showFrom: string;
  showUntil: string;
  image: string | null;
  accent: FestivalAccent;
  showInMenu: boolean;
  active: boolean;
  sortOrder: number;
  productIds: number[];
};

const EMPTY: Draft = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  festivalDate: "",
  showFrom: "",
  showUntil: "",
  image: null,
  accent: "gulal",
  showInMenu: true,
  active: true,
  sortOrder: 0,
  productIds: [],
};

// Dates are picked as Indian calendar days.
const toInput = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    : "";
const fromInput = (v: string, endOfDay = false) =>
  v ? new Date(`${v}T${endOfDay ? "23:59:59" : "00:00:00"}+05:30`) : null;

export default function FestivalEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const isNew = id === "new";
  const trpc = useTRPC();
  const existing = useQuery({
    ...trpc.admin.festival.queryOptions({ id: Number(id) }),
    enabled: !isNew,
  });
  if (!isNew && existing.isLoading)
    return <PageLoader />;
  if (!isNew && !existing.data)
    return (
      <p className="text-ink-soft">
        Page not found.{" "}
        <Link href="/admin/festivals" className="font-bold text-royal">
          Back to custom pages
        </Link>
      </p>
    );
  const f = existing.data;
  const initial: Draft = f
    ? {
        name: f.name,
        slug: f.slug,
        tagline: f.tagline ?? "",
        description: f.description ?? "",
        festivalDate: toInput(f.festivalDate),
        showFrom: toInput(f.showFrom),
        showUntil: toInput(f.showUntil),
        image: f.image,
        accent: f.accent,
        showInMenu: f.showInMenu,
        active: f.active,
        sortOrder: f.sortOrder,
        productIds: f.productIds,
      }
    : EMPTY;
  return (
    <Editor key={id} id={isNew ? undefined : Number(id)} initial={initial} />
  );
}

function Editor({ id, initial }: { id?: number; initial: Draft }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const save = useMutation(
    trpc.admin.saveFestival.mutationOptions({
      onSuccess: (r) => {
        qc.invalidateQueries({ queryKey: trpc.admin.festivals.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.admin.festival.queryKey() });
        toast(id ? "Page saved" : "Page created");
        if (!id)
          window.location.replace(
            `${window.location.pathname.replace(/new$/, String(r.id))}`,
          );
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );
  const del = useMutation(
    trpc.admin.deleteFestival.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.admin.festivals.queryKey() });
        toast("Page deleted");
        window.location.assign(
          window.location.pathname.replace(/\/[^/]+$/, ""),
        );
      },
    }),
  );

  const state = festivalState({
    active: d.active,
    showFrom: fromInput(d.showFrom),
    showUntil: fromInput(d.showUntil, true),
  });
  const stateLine = {
    live: d.showInMenu
      ? "Live now, and shown in the store menu."
      : "Live now. Not in the menu; shoppers reach it by its link.",
    scheduled: `Goes live on ${festivalDay(fromInput(d.showFrom))}.`,
    ended: "Ended. Shoppers can no longer see it.",
    off: "Turned off. Shoppers can’t see it.",
  }[state];

  const submit = () =>
    save.mutate({
      id,
      name: d.name,
      slug: d.slug || undefined,
      tagline: d.tagline || null,
      description: d.description || null,
      festivalDate: fromInput(d.festivalDate),
      showFrom: fromInput(d.showFrom),
      showUntil: fromInput(d.showUntil, true),
      image: d.image,
      accent: d.accent,
      showInMenu: d.showInMenu,
      active: d.active,
      sortOrder: d.sortOrder,
      productIds: d.productIds,
    });

  return (
    <form
      className="w-full pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Link
        href="/admin/festivals"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> All custom pages
      </Link>
      <h1 className="mb-6 text-4xl">
        {id ? d.name || "Custom page" : "New custom page"}
      </h1>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Step
          n={1}
          title="Name and words"
          hint="What shoppers read at the top of the page and in the menu."
        >
          <Field
            label="Page name"
            hint="Keep it short: it’s also the menu label."
          >
            <input
              required
              value={d.name}
              onChange={(e) => {
                const name = e.target.value;
                setD((x) => ({
                  ...x,
                  name,
                  slug: slugTouched ? x.slug : slugify(name),
                }));
              }}
              placeholder="Holi 2027, Corporate gifting…"
              className="field"
              maxLength={60}
            />
          </Field>
          <Field
            label="Page link"
            hint="Letters, numbers and dashes. Changing it breaks links you already shared."
          >
            <div className="flex items-center rounded-xl border border-line-strong bg-paper focus-within:border-royal">
              <span className="pl-3 text-sm whitespace-nowrap text-ink-mute">
                vedicvisa.com/c/
              </span>
              <input
                value={d.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set(
                    "slug",
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  );
                }}
                className="h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none"
                placeholder="corporate-gifting"
                maxLength={60}
              />
            </div>
          </Field>
          <Field
            label="Short line"
            hint="One sentence under the name. Optional."
          >
            <input
              value={d.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Thoughtful bhakti gifts for your team"
              className="field"
              maxLength={140}
            />
          </Field>
          <Field
            label="More about it"
            hint="Shown above the products. Optional."
          >
            <textarea
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="field"
              maxLength={1200}
            />
          </Field>
        </Step>

        <Step
          n={2}
          title="When it shows"
          hint="All optional. Leave the dates empty to keep the page up all the time."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Event day"
              hint="For festivals: shown as “Holi is on …”"
            >
              <input
                type="date"
                value={d.festivalDate}
                onChange={(e) => set("festivalDate", e.target.value)}
                className="field"
              />
            </Field>
            <Field label="Show from">
              <input
                type="date"
                value={d.showFrom}
                onChange={(e) => set("showFrom", e.target.value)}
                className="field"
              />
            </Field>
            <Field label="Hide after">
              <input
                type="date"
                value={d.showUntil}
                min={d.showFrom || undefined}
                onChange={(e) => set("showUntil", e.target.value)}
                className="field"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-3 rounded-xl bg-sky/40 p-4 sm:flex-row sm:gap-8">
            <Toggle
              checked={d.active}
              onChange={(v) => set("active", v)}
              label="Turned on"
            />
            <Toggle
              checked={d.showInMenu}
              onChange={(v) => set("showInMenu", v)}
              label="Show in the store menu"
            />
          </div>
          <p className="text-sm text-ink-soft">
            <span className="font-bold text-ink">
              {FESTIVAL_STATE_LABEL[state]}:
            </span>{" "}
            {stateLine}
          </p>
        </Step>

        <Step
          n={3}
          title="Look"
          hint="The colour of the page and its menu dot. A banner photo is optional."
        >
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Colour"
          >
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={d.accent === a}
                onClick={() => set("accent", a)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border px-3 pr-4 text-sm transition-colors",
                  d.accent === a
                    ? "border-ink font-bold"
                    : "border-line text-ink-soft hover:border-line-strong",
                )}
              >
                <span className={cn("size-6 rounded-full", ACCENT_BAND[a])} />
                {ACCENT_LABEL[a]}
              </button>
            ))}
          </div>
          <BannerPicker image={d.image} onChange={(v) => set("image", v)} />
          <div
            className={cn("rounded-2xl px-5 py-6", ACCENT_BAND[d.accent])}
            aria-label="Preview"
          >
            <p className="text-xs font-bold opacity-80">PREVIEW</p>
            <p className="font-display text-3xl">{d.name || "Page name"}</p>
            {d.tagline && <p className="opacity-90">{d.tagline}</p>}
          </div>
        </Step>

        <div className="xl:col-span-2">
          <Step
            n={4}
            title="Products"
            hint="Pick what belongs on this page. They show in this order."
          >
            <ProductPicker
              ids={d.productIds}
              onChange={(v) => set("productIds", v)}
            />
          </Step>
        </div>

        {id && (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5 xl:col-span-2">
            <div>
              <p className="font-bold">Delete this page</p>
              <p className="text-sm text-ink-soft">
                Products stay in the store. Only this page goes.
              </p>
            </div>
            <ConfirmButton
              onConfirm={() => del.mutate({ id })}
              confirmLabel="Yes, delete"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-bold text-gulal"
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </ConfirmButton>
          </Card>
        )}
      </div>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur lg:left-[248px]">
        <div className="flex items-center justify-between gap-3 lg:px-6">
          <p className="min-w-0 truncate text-sm text-ink-soft">
            {dirty
              ? "You have unsaved changes"
              : id
                ? "All changes saved"
                : "Fill in the steps, then create"}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {id && (
              <a
                href={storeHref(`/c/${initial.slug}`)}
                target="_blank"
                rel="noreferrer"
                className="hidden h-10 items-center rounded-full px-3 text-sm font-bold text-ink-soft hover:text-ink sm:inline-flex"
              >
                View page
              </a>
            )}
            <Button size="sm" disabled={save.isPending || (!dirty && !!id)}>
              {save.isPending ? (
                <Spinner />
              ) : id ? (
                "Save changes"
              ) : (
                "Create page"
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-royal text-sm font-bold text-white">
          {n}
        </span>
        <div>
          <h2 className="font-sans text-lg font-bold">{title}</h2>
          {hint && <p className="text-sm text-ink-soft">{hint}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function BannerPicker({
  image,
  onChange,
}: {
  image: string | null;
  onChange: (v: string | null) => void;
}) {
  const upload = useUploadFile();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-paper-2 text-ink-mute hover:border-royal hover:text-royal"
      >
        {busy ? (
          <Spinner />
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt="Page banner"
            className="size-full object-cover"
          />
        ) : (
          <ImagePlus className="size-6" aria-hidden />
        )}
      </button>
      <div className="text-sm">
        <p className="font-bold">
          {image ? "Banner photo" : "Add a banner photo"}
        </p>
        <p className="text-ink-soft">
          Portrait works best (4:5). JPG, PNG or WebP.
        </p>
        {image && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mt-1 font-bold text-gulal"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onChange(await upload(file));
          } catch (err) {
            toast((err as Error).message, "error");
          }
          setBusy(false);
        }}
      />
    </div>
  );
}

function ProductPicker({
  ids,
  onChange,
}: {
  ids: number[];
  onChange: (ids: number[]) => void;
}) {
  const trpc = useTRPC();
  const { data: all = [], isLoading } = useQuery(
    trpc.admin.productPicker.queryOptions(),
  );
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const chosen = ids.map((i) => byId.get(i)).filter((p) => p !== undefined);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter(
        (p) => !ids.includes(p.id) && (!t || p.name.toLowerCase().includes(t)),
      )
      .slice(0, t ? 30 : 8);
  }, [all, ids, q]);
  const move = (i: number, by: number) => {
    const next = [...ids];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    onChange(next);
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <p className="label">On this page ({chosen.length})</p>
        {chosen.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-mute">
            Nothing yet. Add products from the list.
          </p>
        ) : (
          <ol className="divide-y divide-line rounded-xl border border-line">
            {chosen.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 px-2 py-2">
                <Thumb src={p.image} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.name}
                </span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sky disabled:opacity-30"
                  aria-label={`Move ${p.name} up`}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={i === chosen.length - 1}
                  onClick={() => move(i, 1)}
                  className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sky disabled:opacity-30"
                  aria-label={`Move ${p.name} down`}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(ids.filter((x) => x !== p.id))}
                  className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-gulal-soft hover:text-gulal"
                  aria-label={`Remove ${p.name}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <p className="label">Add products</p>
        <label className="mb-2 flex h-11 items-center gap-2 rounded-xl border border-line-strong px-3 focus-within:border-royal">
          <Search className="size-4 text-ink-mute" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name"
            className="h-full min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        {isLoading && <PageLoader />}
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange([...ids, p.id])}
                className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-sky/50"
              >
                <Thumb src={p.image} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="text-xs text-ink-mute">
                    {inr(p.price)}
                    {p.kind === "bundle" && " · set"}
                    {p.visibility === "hidden" && " · hidden from store"}
                  </span>
                </span>
                <span className="rounded-full bg-sky px-2.5 py-1 text-xs font-bold text-royal">
                  Add
                </span>
              </button>
            </li>
          ))}
          {!isLoading && results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-ink-mute">
              No more products match.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-paper-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" className="size-full object-cover" />}
    </span>
  );
}
