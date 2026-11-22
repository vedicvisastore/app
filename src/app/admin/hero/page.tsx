"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Media, ProductArt, Spinner , PageLoader } from "@/components/ui";
import { HERO_MAX_SLIDES, HERO_PRODUCTS, type HeroSlideConfig, type HeroSlideKind } from "@/lib/hero-slides";
import { useTRPC } from "@/lib/trpc/client";
import { cn, inr, storeHref } from "@/lib/utils";
import { Card, Field, PageHeader, Toggle, useToast } from "../_ui";

type Product = { id: number; name: string; image: string | null; price: number; kind: "single" | "bundle"; group: string | null; category: string | null; soldOut: boolean };

const KINDS: { value: HeroSlideKind; label: string; hint: string }[] = [
  { value: "brand", label: "Logo and words", hint: "The VedicVisa logo, a headline and a button. No products." },
  { value: "feature", label: "One product", hint: "One product standing on the long stone step, with its price." },
  { value: "trio", label: "Three products", hint: "Three products on three stone steps, each with its price." },
];

const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export default function HeroPage() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.admin.heroSlides.queryOptions());
  if (!data) return <PageLoader />;
  return <Editor key={JSON.stringify(data.saved)} saved={data.saved} automatic={data.automatic} products={data.products} />;
}

function Editor({ saved, automatic, products }: { saved: HeroSlideConfig[]; automatic: HeroSlideConfig[]; products: Product[] }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const isAuto = saved.length === 0;
  const start = isAuto ? automatic : saved;
  const [slides, setSlides] = useState<HeroSlideConfig[]>(start);
  const [base, setBase] = useState(JSON.stringify(start));
  const dirty = JSON.stringify(slides) !== base;
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const done = (msg: string) => {
    qc.invalidateQueries({ queryKey: trpc.admin.heroSlides.queryKey() });
    toast(msg);
  };
  const save = useMutation(
    trpc.admin.saveHeroSlides.mutationOptions({
      onSuccess: (_d, v) => {
        setBase(JSON.stringify(v.slides));
        done(v.slides.length ? "Banner updated in the store" : "Banner is automatic again");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  const update = (i: number, patch: Partial<HeroSlideConfig>) => setSlides((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, by: number) =>
    setSlides((xs) => {
      const next = [...xs];
      const [x] = next.splice(i, 1);
      next.splice(i + by, 0, x);
      return next;
    });
  const shown = slides.filter((s) => !s.hidden).length;

  return (
    <div className="w-full max-w-3xl pb-28">
      <PageHeader
        title="Home banner"
        description="The big sliding banner at the top of the home page. Each slide is one step below: choose its type, write its words, then pick its products."
        actions={
          <a href={storeHref("/")} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-bold text-ink-soft hover:text-royal">
            See it on the store <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      <div className={cn("mb-6 rounded-2xl px-4 py-3 text-sm", isAuto ? "bg-sky text-ink" : "bg-paper-2 text-ink-soft")}>
        {isAuto ? (
          <>
            <b>The banner is automatic right now.</b> It shows the logo, your signature Bhakti Box, three single items and three sets, picked from the catalogue. These are those slides: change anything and save, and the banner shows exactly what you set here.
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>You are choosing the slides. Hidden products drop out of a slide by themselves.</span>
            <button type="button" className="font-bold text-royal" disabled={save.isPending} onClick={() => save.mutate({ slides: [] })}>
              Go back to automatic
            </button>
          </div>
        )}
      </div>

      <ol className="space-y-5">
        {slides.map((s, i) => (
          <li key={s.id}>
            <SlideCard
              n={i + 1}
              s={s}
              byId={byId}
              products={products}
              first={i === 0}
              last={i === slides.length - 1}
              onChange={(patch) => update(i, patch)}
              onMove={(by) => move(i, by)}
              onRemove={() => setSlides((xs) => xs.filter((_, j) => j !== i))}
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        disabled={slides.length >= HERO_MAX_SLIDES}
        onClick={() => setSlides((xs) => [...xs, { id: newId(), kind: "feature", title: "", action: "Shop now", href: "/shop", productIds: [] }])}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm font-bold text-royal hover:border-royal disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden /> Add a slide ({slides.length} of {HERO_MAX_SLIDES})
      </button>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            {dirty ? "You have unsaved changes" : isAuto ? "Automatic banner" : "All changes saved"} · {shown} {shown === 1 ? "slide" : "slides"} showing
          </p>
          <div className="flex gap-2">
            {dirty && (
              <Button size="sm" variant="ghost" onClick={() => setSlides(JSON.parse(base))}>
                Discard
              </Button>
            )}
            <Button size="sm" disabled={!dirty || save.isPending || shown === 0} onClick={() => save.mutate({ slides })}>
              {save.isPending ? <Spinner /> : "Save banner"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideCard({
  n,
  s,
  byId,
  products,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  n: number;
  s: HeroSlideConfig;
  byId: Map<number, Product>;
  products: Product[];
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<HeroSlideConfig>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const need = HERO_PRODUCTS[s.kind];
  const picked = s.productIds.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  const missing = s.productIds.length - picked.length;
  return (
    <Card className={cn("overflow-hidden", s.hidden && "opacity-70")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sky/40 px-4 py-2.5">
        <p className="font-bold">
          Slide {n}
          <span className="ml-2 text-sm font-normal text-ink-soft">{KINDS.find((k) => k.value === s.kind)?.label}</span>
        </p>
        <div className="flex items-center gap-1">
          <Toggle checked={!s.hidden} onChange={(v) => onChange({ hidden: !v })} label={s.hidden ? "Hidden" : "Showing"} />
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <IconBtn label="Move up" disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn label="Move down" disabled={last} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn label="Delete slide" danger onClick={onRemove}>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        <Step n={1} title="Type">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={`Slide ${n} type`}>
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={s.kind === k.value}
                onClick={() => onChange({ kind: k.value, productIds: s.productIds.slice(0, HERO_PRODUCTS[k.value]) })}
                className={cn("rounded-xl border p-3 text-left", s.kind === k.value ? "border-royal bg-royal/5 ring-1 ring-royal" : "border-line hover:border-ink")}
              >
                <span className="block text-sm font-bold">{k.label}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{k.hint}</span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="Words">
          <div className="grid gap-3 sm:grid-cols-2">
            {s.kind !== "brand" && (
              <Field label="Small label above the headline (optional)" className="sm:col-span-2">
                <input className="field" value={s.label ?? ""} maxLength={40} placeholder="Bhakti Boxes" onChange={(e) => onChange({ label: e.target.value })} />
              </Field>
            )}
            <Field label="Headline" className="sm:col-span-2">
              <input className="field" value={s.title} maxLength={80} placeholder="Bhakti, for every day." onChange={(e) => onChange({ title: e.target.value })} />
            </Field>
            {s.kind !== "trio" && (
              <Field label="Sentence under it (optional)" className="sm:col-span-2">
                <textarea className="field min-h-20" value={s.lede ?? ""} maxLength={200} onChange={(e) => onChange({ lede: e.target.value })} />
              </Field>
            )}
            <Field label="Button words">
              <input className="field" value={s.action} maxLength={32} placeholder="Shop now" onChange={(e) => onChange({ action: e.target.value })} />
            </Field>
            <Field label="Button opens" hint="A store page like /shop, /shop?group=items or /p/vrindavan-bhakti-box">
              <input className="field" value={s.href} maxLength={300} placeholder="/shop" onChange={(e) => onChange({ href: e.target.value })} />
            </Field>
            {s.kind === "brand" && (
              <>
                <Field label="Second link words (optional)">
                  <input className="field" value={s.secondaryLabel ?? ""} maxLength={32} placeholder="Our story" onChange={(e) => onChange({ secondaryLabel: e.target.value })} />
                </Field>
                <Field label="Second link opens">
                  <input className="field" value={s.secondaryHref ?? ""} maxLength={300} placeholder="/about" onChange={(e) => onChange({ secondaryHref: e.target.value })} />
                </Field>
              </>
            )}
          </div>
        </Step>

        {need > 0 && (
          <Step n={3} title={need === 1 ? "Product" : "Three products"}>
            <ul className="mb-3 grid gap-2 sm:grid-cols-3">
              {Array.from({ length: need }).map((_, i) => {
                const p = picked[i];
                return (
                  <li key={i} className={cn("flex items-center gap-2 rounded-xl border p-2", p ? "border-line" : "border-dashed border-line-strong text-ink-mute")}>
                    {p ? (
                      <>
                        <Thumb p={p} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{p.name}</span>
                          <span className="text-xs text-ink-soft">{inr(p.price)}{p.soldOut && " · sold out"}</span>
                        </span>
                        <IconBtn label={`Remove ${p.name}`} onClick={() => onChange({ productIds: s.productIds.filter((id) => id !== p.id) })}>
                          <X className="size-4" />
                        </IconBtn>
                      </>
                    ) : (
                      <span className="px-2 py-3 text-sm">{need === 1 ? "Pick a product below" : `Spot ${i + 1}: pick below`}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {missing > 0 && <p className="mb-3 text-xs text-gulal">{missing === 1 ? "One product here is" : `${missing} products here are`} hidden from the store, so pick another.</p>}
            {picked.length < need && <Picker products={products} exclude={s.productIds} onPick={(id) => onChange({ productIds: [...s.productIds.filter((x) => byId.has(x)), id].slice(0, need) })} />}
          </Step>
        )}
      </div>
    </Card>
  );
}

function Picker({ products, exclude, onPick }: { products: Product[]; exclude: number[]; onPick: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "single" | "bundle">("all");
  const list = products
    .filter((p) => !exclude.includes(p.id))
    .filter((p) => type === "all" || p.kind === type)
    .filter((p) => !q || `${p.name} ${p.group ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(!!b.image) - Number(!!a.image))
    .slice(0, 12);
  return (
    <div className="rounded-xl bg-paper-2 p-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-paper px-3 focus-within:border-royal">
          <Search className="size-4 shrink-0 text-ink-mute" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" aria-label="Search products" />
        </label>
        <div className="flex rounded-full bg-paper p-0.5" role="radiogroup" aria-label="Product type">
          {(
            [
              ["all", "All"],
              ["single", "Single items"],
              ["bundle", "Boxes & sets"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={type === v} onClick={() => setType(v)} className={cn("h-9 rounded-full px-3 text-xs font-bold whitespace-nowrap", type === v ? "bg-ink text-white" : "text-ink-soft")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-2 rounded-lg bg-paper p-1.5 text-left hover:ring-1 hover:ring-royal">
              <Thumb p={p} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="text-xs text-ink-mute">
                  {inr(p.price)} · {p.group ?? p.category ?? "Item"}
                  {!p.image && " · no photo yet"}
                </span>
              </span>
              <Plus className="size-4 shrink-0 text-royal" aria-hidden />
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="p-3 text-sm text-ink-mute">No products match.</li>}
      </ul>
      <p className="mt-2 text-xs text-ink-mute">Only products showing in the store are listed. Products with photos look best in the banner.</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 font-sans text-base font-bold">
        <span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Thumb({ p }: { p: Product }) {
  return <span className="block h-11 w-9 shrink-0 overflow-hidden rounded-md bg-sky">{p.image ? <Media src={p.image} alt="" className="h-full w-full object-cover" /> : <ProductArt name={p.name} seed={p.id} />}</span>;
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn("grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sky disabled:opacity-30", danger && "hover:bg-gulal-soft hover:text-gulal")}>
      {children}
    </button>
  );
}
