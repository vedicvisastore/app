"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, GripVertical, ImagePlus, Search, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { Button, Media, ProductArt, Spinner , PageLoader } from "@/components/ui";
import type { ProductKind, Visibility } from "@/db/schema";
import { useTRPC } from "@/lib/trpc/client";
import { adminLabel, cn, inr, slugify } from "@/lib/utils";
import { Card, ConfirmButton, Field, MoneyInput, PageHeader, Toggle, useToast } from "../../_ui";

type FormState = {
  name: string;
  adminName: string;
  sku: string;
  slug: string;
  kind: ProductKind;
  bundleGroup: string;
  categoryId: number | null;
  tagline: string;
  description: string;
  price: number;
  mrp: number | null;
  cost: number;
  stock: number | null;
  trackStock: boolean;
  visibility: Visibility;
  images: string[];
  pinRank: number | null;
  boost: number;
  featured: boolean;
  comingSoon: boolean;
  launchAt: string;
  components: { productId: number; qty: number }[];
};

const blank = (kind: ProductKind): FormState => ({
  name: "", adminName: "", sku: "", slug: "", kind, bundleGroup: kind === "bundle" ? "Bhakti Boxes" : "", categoryId: null, tagline: "", description: "",
  price: 0, mrp: null, cost: 0, stock: kind === "single" ? 0 : null, trackStock: kind === "single", visibility: "hidden", images: [], pinRank: null, boost: 0, featured: false, comingSoon: false, launchAt: "", components: [],
});

function MediaUploader({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const trpc = useTRPC();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const presign = useMutation(trpc.admin.presignUpload.mutationOptions());

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const added: string[] = [];
    setBusy(files.length);
    for (const file of Array.from(files)) {
      try {
        const p = await presign.mutateAsync({ filename: file.name, contentType: file.type, size: file.size });
        if (p.mode === "r2") {
          const res = await fetch(p.uploadUrl, { method: "PUT", body: file, headers: p.headers });
          if (!res.ok) throw new Error(`R2 upload failed (${res.status}). Check the bucket's CORS settings.`);
          added.push(p.publicUrl);
        } else {
          const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file, headers: { "Content-Type": file.type } });
          const j = (await res.json()) as { url?: string; error?: string };
          if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed");
          added.push(j.url);
        }
      } catch (e) {
        toast(`${file.name}: ${(e as Error).message}`, "error");
      }
      setBusy((b) => b - 1);
    }
    if (added.length) onChange([...images, ...added]);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {images.map((src, i) => (
          <div
            key={src}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnter={() => drag != null && setOver(i)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onDrop={() => {
              if (drag != null && drag !== i) onChange(moveTo(images, drag, i));
              setDrag(null);
              setOver(null);
            }}
            className={cn(
              "group relative flex cursor-grab flex-col overflow-hidden rounded-xl border bg-paper transition active:cursor-grabbing",
              i === 0 ? "border-gold ring-2 ring-gold/60" : "border-line",
              drag === i && "opacity-40",
              over === i && drag !== i && "ring-2 ring-royal",
            )}
          >
            <div className="relative aspect-square bg-sky">
              <Media src={src} alt="" className="pointer-events-none h-full w-full object-cover" />
              <span className={cn("absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold", i === 0 ? "bg-gold text-shyam" : "bg-ink/75 text-white")}>{i === 0 ? "Cover" : i + 1}</span>
              <GripVertical className="absolute top-1.5 right-1.5 size-5 rounded bg-ink/50 p-0.5 text-white" aria-hidden />
            </div>
            {/* Buttons as well as dragging: dragging doesn't work on phones */}
            <div className="flex items-center justify-between gap-0.5 border-t border-line px-1 py-1">
              <PhotoBtn label="Move left" disabled={i === 0} onClick={() => onChange(moveTo(images, i, i - 1))}>
                <ChevronLeft className="size-4" />
              </PhotoBtn>
              {i > 0 ? (
                <PhotoBtn label="Make cover" onClick={() => onChange(moveTo(images, i, 0))}>
                  <Star className="size-4" />
                </PhotoBtn>
              ) : (
                <span className="size-8" />
              )}
              <PhotoBtn label="Move right" disabled={i === images.length - 1} onClick={() => onChange(moveTo(images, i, i + 1))}>
                <ChevronRight className="size-4" />
              </PhotoBtn>
              <PhotoBtn label="Remove" danger onClick={() => onChange(images.filter((x) => x !== src))}>
                <X className="size-4" />
              </PhotoBtn>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
          className="grid min-h-32 place-items-center rounded-xl border-2 border-dashed border-line-strong text-ink-soft transition-colors hover:border-royal hover:text-royal"
        >
          {busy > 0 ? <Spinner /> : <span className="flex flex-col items-center gap-1 text-xs font-bold"><ImagePlus className="size-5" /> Add photos or video</span>}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      <p className="mt-2 text-xs text-ink-mute">Drag a photo to a new spot, or use the arrows. ★ makes a photo the cover (the first one, shown on product cards). Add as many as you like (up to 24): photos up to 10 MB, videos up to 100 MB.</p>
    </div>
  );
}

function ComponentPicker({ value, onChange, selfId }: { value: FormState["components"]; onChange: (c: FormState["components"]) => void; selfId?: number }) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.admin.products.queryOptions({ kind: "single" }));
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map((data ?? []).map((p) => [p.id, p])), [data]);
  const matches = (data ?? []).filter((p) => p.id !== selfId && !value.some((v) => v.productId === p.id) && (!q || `${p.name} ${p.adminName ?? ""} ${p.sku}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 8);

  return (
    <div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {value.length === 0 && <li className="p-4 text-sm text-ink-mute">No items yet. Search below to add products and packing materials.</li>}
        {value.map((c) => {
          const p = byId.get(c.productId);
          return (
            <li key={c.productId} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">
                {p ? adminLabel(p) : `#${c.productId}`}
                {p?.visibility === "internal" && <span className="ml-2 rounded-full bg-line/70 px-2 py-0.5 text-[11px] text-ink-soft">packing</span>}
              </span>
              <span className="w-16 text-right text-xs text-ink-mute tabular-nums">{p ? inr(p.cost) : ""}</span>
              <input
                type="number"
                min={1}
                max={50}
                value={c.qty}
                onChange={(e) => onChange(value.map((v) => (v.productId === c.productId ? { ...v, qty: Math.max(1, Math.min(50, Number(e.target.value) || 1)) } : v)))}
                className="h-8 w-14 rounded-lg border border-line px-2 text-center tabular-nums"
                aria-label={`Quantity of ${p?.name}`}
              />
              <button type="button" onClick={() => onChange(value.filter((v) => v.productId !== c.productId))} className="text-ink-mute hover:text-gulal" aria-label="Remove">
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products to add to this box" className="field pl-9" />
      </div>
      {(q || value.length === 0) && matches.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {matches.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onChange([...value, { productId: p.id, qty: 1 }]); setQ(""); }} className={cn("rounded-full border px-3 py-1 text-sm hover:border-royal hover:text-royal", p.visibility === "internal" ? "border-dashed border-line-strong text-ink-soft" : "border-line")}>
                + {adminLabel(p)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Editor({ id }: { id: string }) {
  const isNew = id === "new";
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [f, setF] = useState<FormState>(() => blank(params.get("kind") === "bundle" ? "bundle" : "single"));
  const [loaded, setLoaded] = useState(isNew);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  const product = useQuery({ ...trpc.admin.product.queryOptions({ id: Number(id) }), enabled: !isNew });
  const cats = useQuery(trpc.admin.categories.queryOptions());
  const singles = useQuery(trpc.admin.products.queryOptions({ kind: "single" }));
  const bundles = useQuery(trpc.admin.products.queryOptions({ kind: "bundle" }));

  useEffect(() => {
    const p = product.data;
    if (!p || loaded) return;
    setF({
      name: p.name, adminName: p.adminName ?? "", sku: p.sku, slug: p.slug, kind: p.kind, bundleGroup: p.bundleGroup ?? "", categoryId: p.categoryId, tagline: p.tagline ?? "", description: p.description ?? "",
      price: p.price, mrp: p.mrp, cost: p.cost, stock: p.stock, trackStock: p.stock != null, visibility: p.visibility, images: p.images, pinRank: p.pinRank, boost: p.boost, featured: p.featured, comingSoon: p.comingSoon, launchAt: p.launchAt ? new Date(new Date(p.launchAt).getTime() - new Date(p.launchAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "", components: p.components,
    });
    setLoaded(true);
  }, [product.data, loaded]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const byId = new Map((singles.data ?? []).map((p) => [p.id, p]));
  const compCost = f.components.reduce((s, c) => s + (byId.get(c.productId)?.cost ?? 0) * c.qty, 0);
  const compValue = f.components.reduce((s, c) => { const p = byId.get(c.productId); return s + (p && p.visibility === "public" ? p.price * c.qty : 0); }, 0);
  const cost = f.kind === "bundle" ? compCost : f.cost;
  const profit = f.price - cost;
  const margin = f.price ? Math.round((profit / f.price) * 100) : 0;
  const groups = [...new Set((bundles.data ?? []).map((b) => b.bundleGroup).filter(Boolean) as string[])];

  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.admin.products.queryKey() });
  const save = useMutation(
    trpc.admin.saveProduct.mutationOptions({
      onSuccess: (r) => {
        invalidate();
        qc.invalidateQueries({ queryKey: trpc.admin.product.queryKey({ id: r.id }) });
        toast(isNew ? "Product created" : "Changes saved");
        if (isNew) router.replace(`/admin/products/${r.id}`);
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );
  const del = useMutation(trpc.admin.deleteProduct.mutationOptions({ onSuccess: () => { invalidate(); toast("Deleted"); router.replace(f.kind === "bundle" ? "/admin/bundles" : "/admin/products"); }, onError: (e) => toast(e.message, "error") }));

  if (!loaded) return <PageLoader />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      id: isNew ? undefined : Number(id),
      name: f.name, adminName: f.adminName.trim() || null, sku: f.sku || "VV-" + slugify(f.name).toUpperCase().slice(0, 24), slug: f.slug || undefined, kind: f.kind,
      bundleGroup: f.bundleGroup || null, categoryId: f.categoryId, tagline: f.tagline || null, description: f.description || null,
      price: f.price, mrp: f.mrp, cost, stock: f.trackStock ? (f.stock ?? 0) : null, visibility: f.visibility, images: f.images,
      pinRank: f.pinRank, boost: f.boost, featured: f.featured, comingSoon: f.comingSoon, launchAt: f.launchAt ? new Date(f.launchAt) : null, components: f.kind === "bundle" ? f.components : [],
    });
  };

  return (
    <form onSubmit={submit}>
      <Link href={f.kind === "bundle" ? "/admin/bundles" : "/admin/products"} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-royal">
        <ArrowLeft className="size-4" /> {f.kind === "bundle" ? "Boxes & bundles" : "Products"}
      </Link>
      <PageHeader
        title={isNew ? (f.kind === "bundle" ? "New box" : "New product") : f.adminName || f.name || "Untitled"}
        actions={
          <>
            {!isNew && f.visibility === "public" && <Link href={`/p/${f.slug}`} target="_blank" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-bold text-ink-soft hover:text-royal">View in store</Link>}
            <Button size="sm" disabled={save.isPending}>{save.isPending && <Spinner />} {isNew ? "Create" : "Save changes"}</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div className="flex gap-2">
              {(["single", "bundle"] as const).map((k) => (
                <button key={k} type="button" onClick={() => set("kind", k)} className={cn("rounded-full border px-4 py-1.5 text-sm font-bold", f.kind === k ? "border-ink bg-ink text-white" : "border-line text-ink-soft")}>
                  {k === "single" ? "Single product" : "Box / bundle"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name customers see">
                <input required value={f.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} className="field" />
              </Field>
              <Field label="Admin name (optional)" hint="Only you see this, in admin lists and pickers. Leave empty to use the customer name.">
                <input value={f.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder={f.name || "e.g. Hari box, blue pack 2026"} maxLength={120} className="field" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU" hint="Must be unique. Leave empty to generate one."><input value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} className="field font-mono" /></Field>
              <Field label="URL" hint={`/p/${f.slug || "…"}`}><input value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} className="field" /></Field>
            </div>
            <Field label="Tagline" hint="One line under the name, e.g. “Your first step into daily japa”"><input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} className="field" maxLength={140} /></Field>
            <Field label="Description"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={6} className="field" /></Field>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-sans text-lg font-bold">Photos and video</h2>
            <MediaUploader images={f.images} onChange={(imgs) => set("images", imgs)} />
          </Card>

          {f.kind === "bundle" && (
            <Card className="p-5">
              <h2 className="font-sans text-lg font-bold">What's in this box</h2>
              <p className="mb-3 text-sm text-ink-soft">Add packing and delivery items too, so cost and stock stay accurate. Customers only see store items.</p>
              <ComponentPicker value={f.components} onChange={(c) => set("components", c)} selfId={isNew ? undefined : Number(id)} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="font-sans text-lg font-bold">Pricing</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Selling price"><MoneyInput value={f.price} onChange={(v) => set("price", v ?? 0)} required /></Field>
              <Field label="MRP (strike-through)" hint="Optional"><MoneyInput value={f.mrp} allowEmpty onChange={(v) => set("mrp", v)} /></Field>
            </div>
            {f.kind === "single" ? (
              <Field label="Your cost"><MoneyInput value={f.cost} onChange={(v) => set("cost", v ?? 0)} /></Field>
            ) : (
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-sky/60 p-3 text-sm">
                <div><p className="text-xs text-ink-soft">Cost of contents</p><p className="font-bold tabular-nums">{inr(compCost)}</p></div>
                <div><p className="text-xs text-ink-soft">Item value to customer</p><p className="font-bold tabular-nums">{inr(compValue)}</p></div>
              </div>
            )}
            <p className={cn("rounded-xl px-3 py-2 text-sm font-bold", margin < 40 ? "bg-gulal-soft text-gulal" : "bg-mor-soft text-mor")}>
              Profit {inr(profit)} per unit ({margin}% margin)
            </p>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-sans text-lg font-bold">Organise</h2>
            <Field label="Visibility">
              <select value={f.visibility} onChange={(e) => set("visibility", e.target.value as Visibility)} className="field">
                <option value="public">In store</option>
                <option value="hidden">Hidden (draft)</option>
                <option value="internal">Packing / internal (never sold alone)</option>
              </select>
            </Field>
            <Field label="Category">
              <select value={f.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : null)} className="field">
                <option value="">No category</option>
                {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            {f.kind === "bundle" && (
              <Field label="Box group" hint="Boxes in the same group are shown together, e.g. Bhakti Boxes, Japa Sets">
                <input value={f.bundleGroup} onChange={(e) => set("bundleGroup", e.target.value)} list="groups" className="field" />
                <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              </Field>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-sans text-lg font-bold">Stock</h2>
            {f.kind === "bundle" && <p className="text-sm text-ink-soft">Boxes are limited by their items' stock automatically. Track a separate count only for pre-packed boxes.</p>}
            <Toggle checked={f.trackStock} onChange={(v) => setF((s) => ({ ...s, trackStock: v, stock: v ? s.stock ?? 0 : null }))} label="Track stock" />
            {f.trackStock && (
              <Field label="Units in stock" hint="Changing this records a correction in the ledger. For deliveries, use Add stock in the ledger.">
                <input type="number" min={0} value={f.stock ?? 0} onChange={(e) => set("stock", Math.max(0, Number(e.target.value) || 0))} className="field tabular-nums" />
              </Field>
            )}
            {!isNew && <div className="flex flex-wrap gap-4"><Link href={`/admin/stock/${id}`} className="inline-block text-sm font-bold text-royal">Open stock ledger</Link><Link href={`/admin/analytics/products/${id}`} className="inline-block text-sm font-bold text-royal">See sales</Link></div>}
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-sans text-lg font-bold">Placement in the shop</h2>
            <p className="text-sm text-ink-soft">By default the shop sorts by what's selling in the last 14 days. Pin to lift something to the top yourself.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pin position" hint="1 = first. Empty = automatic.">
                <input type="number" min={1} value={f.pinRank ?? ""} onChange={(e) => set("pinRank", e.target.value ? Math.max(1, Number(e.target.value)) : null)} className="field tabular-nums" />
              </Field>
              <Field label="Trending boost" hint="Extra points; one sale ≈ 10">
                <input type="number" value={f.boost} onChange={(e) => set("boost", Number(e.target.value) || 0)} className="field tabular-nums" />
              </Field>
            </div>
            <Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Featured" />
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-sans text-lg font-bold">Launching soon</h2>
            <p className="text-sm text-ink-soft">Show it in the store with a “Launching soon” tag. Shoppers can see it but can’t buy it yet.</p>
            <Toggle checked={f.comingSoon} onChange={(v) => set("comingSoon", v)} label="Launching soon" />
            {f.comingSoon && (
              <Field label="Launch date (optional)" hint="It goes on sale by itself at this time. Leave empty to launch it yourself by switching the tag off.">
                <input type="datetime-local" value={f.launchAt} onChange={(e) => set("launchAt", e.target.value)} className="field" />
              </Field>
            )}
          </Card>

          {!isNew && (
            <Card className="flex items-center justify-between p-5">
              <p className="text-sm text-ink-soft">Delete permanently. Past orders keep their details.</p>
              <ConfirmButton onConfirm={() => del.mutate({ id: Number(id) })} confirmLabel="Delete forever" className="text-sm font-bold text-gulal">Delete</ConfirmButton>
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}

export default function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <Editor key={id} id={id} />
    </Suspense>
  );
}

function moveTo<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

function PhotoBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={cn("grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sky hover:text-ink disabled:opacity-25", danger && "hover:bg-gulal-soft hover:text-gulal")}>
      {children}
    </button>
  );
}
