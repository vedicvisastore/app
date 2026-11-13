"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Grid3x3, LayoutList, Plus } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { ButtonLink, Media, ProductArt, Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { cn, inr } from "@/lib/utils";
import { Card, NumberCell, PageHeader, useToast } from "../_ui";

export default function BundlesPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<"cards" | "matrix">("cards");
  const bundles = useQuery(trpc.admin.products.queryOptions({ kind: "bundle" }));
  const singles = useQuery({ ...trpc.admin.products.queryOptions({ kind: "single" }), enabled: view === "matrix" });
  const quick = useMutation(
    trpc.admin.quickUpdate.mutationOptions({ onSuccess: () => { qc.invalidateQueries({ queryKey: trpc.admin.products.queryKey() }); toast("Saved"); } }),
  );

  const list = bundles.data ?? [];
  const groups = [...new Set(list.map((b) => b.bundleGroup ?? "Other bundles"))];

  return (
    <>
      <PageHeader
        title="Boxes & bundles"
        description="Each box is a club of products. Cost includes packing and delivery items; “item value” is what the customer-facing items would cost separately."
        actions={
          <>
            <div className="flex rounded-full border border-line bg-paper p-0.5">
              <button onClick={() => setView("cards")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold", view === "cards" ? "bg-ink text-white" : "text-ink-soft")}><LayoutList className="size-4" /> Boxes</button>
              <button onClick={() => setView("matrix")} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold", view === "matrix" ? "bg-ink text-white" : "text-ink-soft")}><Grid3x3 className="size-4" /> Matrix</button>
            </div>
            <ButtonLink href="/admin/products/new?kind=bundle" size="sm"><Plus className="size-4" /> New box</ButtonLink>
          </>
        }
      />
      {bundles.isLoading && <Spinner className="text-ink-mute" />}

      {view === "cards" &&
        groups.map((g) => (
          <section key={g} className="mb-10">
            <h2 className="mb-3 font-sans text-lg font-bold">{g}</h2>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {list
                .filter((b) => (b.bundleGroup ?? "Other bundles") === g)
                .map((b) => {
                  const profit = b.price - b.componentCost;
                  const margin = b.price ? Math.round((profit / b.price) * 100) : 0;
                  const visible = b.components.filter((c) => c.visibility === "public");
                  const internal = b.components.filter((c) => c.visibility !== "public");
                  return (
                    <Card key={b.id} className="flex flex-col p-5">
                      <div className="flex gap-4">
                        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-sky">{b.images[0] ? <Media src={b.images[0]} alt="" className="h-full w-full object-cover" /> : <ProductArt name={b.name} seed={b.id} className="[&_span]:text-xl" />}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/admin/products/${b.id}`} className="font-display text-2xl leading-tight hover:text-royal">{b.name}</Link>
                            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", b.visibility === "public" ? "bg-mor-soft text-mor" : "bg-line text-ink-soft")}>{b.visibility === "public" ? "In store" : "Hidden"}</span>
                          </div>
                          <p className="text-xs text-ink-mute">{b.sku}, {visible.length} items + {internal.length} packing/delivery</p>
                        </div>
                      </div>
                      <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-sky/60 p-3 text-center text-sm">
                        <div><dt className="text-xs text-ink-soft">Cost</dt><dd className="font-bold tabular-nums">{inr(b.componentCost)}</dd></div>
                        <div><dt className="text-xs text-ink-soft">Item value</dt><dd className="font-bold tabular-nums">{inr(b.componentValue)}</dd></div>
                        <div><dt className="text-xs text-ink-soft">Price{b.mrp ? ` / MRP` : ""}</dt><dd className="font-bold tabular-nums">{inr(b.price)}{b.mrp && <s className="ml-1 text-xs font-normal text-ink-mute">{inr(b.mrp)}</s>}</dd></div>
                        <div><dt className="text-xs text-ink-soft">Profit</dt><dd className={cn("font-bold tabular-nums", margin < 50 ? "text-gulal" : "text-mor")}>{inr(profit)} <span className="text-xs">({margin}%)</span></dd></div>
                      </dl>
                      <ul className="mt-4 flex flex-wrap gap-1.5">
                        {visible.map((c) => (
                          <li key={c.productId} className="rounded-full border border-line px-2.5 py-0.5 text-xs">{c.qty > 1 && `${c.qty}× `}{c.name}</li>
                        ))}
                        {internal.map((c) => (
                          <li key={c.productId} className="rounded-full bg-line/60 px-2.5 py-0.5 text-xs text-ink-soft">{c.qty > 1 && `${c.qty}× `}{c.name}</li>
                        ))}
                      </ul>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
                        <span className="flex items-center gap-2 text-ink-soft">
                          Can pack: <b className={cn(b.available === 0 ? "text-gulal" : "text-ink")}>{b.available ?? "∞"}</b>
                        </span>
                        <span className="flex items-center gap-2 text-ink-soft">Pin <NumberCell value={b.pinRank} width="w-12" placeholder="—" onSave={(v) => quick.mutate({ id: b.id, pinRank: v && v > 0 ? v : null })} /></span>
                        <Link href={`/admin/products/${b.id}`} className="font-bold text-royal">Edit box</Link>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </section>
        ))}

      {view === "matrix" && (
        <Card className="overflow-x-auto">
          {singles.isLoading ? (
            <div className="p-5"><Spinner className="text-ink-mute" /></div>
          ) : (
            <table className="text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky left-0 z-10 min-w-[220px] bg-paper px-3 py-2 text-left text-xs font-bold text-ink-soft">Product</th>
                  <th className="px-2 py-2 text-right text-xs font-bold text-ink-soft">Cost</th>
                  {list.map((b) => (
                    <th key={b.id} className="h-36 w-10 px-1 align-bottom">
                      <Link href={`/admin/products/${b.id}`} className="block origin-bottom-left translate-x-5 -rotate-45 text-left text-xs font-bold whitespace-nowrap hover:text-royal">{b.name}</Link>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-xs font-bold text-ink-soft">Used in</th>
                </tr>
              </thead>
              <tbody>
                {(["public", "hidden", "internal"] as const).map((vis) => {
                  const rows = (singles.data ?? []).filter((p) => p.visibility === vis);
                  if (!rows.length) return null;
                  return (
                    <Fragment key={vis}>
                      <tr><td colSpan={list.length + 3} className="sticky left-0 bg-sky/50 px-3 py-1.5 text-xs font-bold text-ink-soft">{vis === "public" ? "Store items" : vis === "hidden" ? "Hidden items" : "Packing & delivery"}</td></tr>
                      {rows.map((p) => {
                        const n = list.filter((b) => b.components.some((c) => c.productId === p.id)).length;
                        return (
                          <tr key={p.id} className="border-b border-line/70 hover:bg-sky/30">
                            <td className="sticky left-0 z-10 bg-paper px-3 py-1.5"><Link href={`/admin/products/${p.id}`} className="hover:text-royal">{p.name}</Link></td>
                            <td className="px-2 py-1.5 text-right text-ink-soft tabular-nums">{inr(p.cost)}</td>
                            {list.map((b) => {
                              const c = b.components.find((x) => x.productId === p.id);
                              return (
                                <td key={b.id} className="px-1 py-1.5 text-center">
                                  {c ? <span className="inline-grid size-6 place-items-center rounded-md bg-mor-soft text-mor">{c.qty > 1 ? <b className="text-xs">{c.qty}</b> : <Check className="size-3.5" />}</span> : <span className="text-line-strong">·</span>}
                                </td>
                              );
                            })}
                            <td className="px-3 py-1.5 text-ink-soft tabular-nums">{n || <span className="text-ink-mute">none</span>}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                <tr className="border-t-2 border-line bg-sky/40 font-bold">
                  <td className="sticky left-0 bg-sky px-3 py-2">Box cost</td><td />
                  {list.map((b) => <td key={b.id} className="px-1 py-2 text-center text-xs tabular-nums">{Math.round(b.componentCost / 100)}</td>)}<td />
                </tr>
                <tr className="bg-sky/40 font-bold">
                  <td className="sticky left-0 bg-sky px-3 py-2">Box price</td><td />
                  {list.map((b) => <td key={b.id} className="px-1 py-2 text-center text-xs tabular-nums">{Math.round(b.price / 100)}</td>)}<td />
                </tr>
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
}
