"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { ButtonLink, Media, ProductArt, Spinner , PageLoader } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { adminLabel, cn, inr } from "@/lib/utils";
import { Card, NumberCell, PageHeader, Tabs, Toggle, useToast } from "../_ui";

export default function BundlesPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<"cards" | "matrix">("cards");
  const [group, setGroup] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const bundles = useQuery(trpc.admin.products.queryOptions({ kind: "bundle" }));
  const singles = useQuery({ ...trpc.admin.products.queryOptions({ kind: "single" }), enabled: view === "matrix" });
  const quick = useMutation(
    trpc.admin.quickUpdate.mutationOptions({
      onSuccess: (_d, v) => {
        qc.invalidateQueries({ queryKey: trpc.admin.products.queryKey() });
        toast(v.visibility === "hidden" ? "Hidden from the store" : v.visibility === "public" ? "Showing in the store" : "Saved");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  const list = bundles.data ?? [];
  const groups = [...new Set(list.map((b) => b.bundleGroup ?? "Other sets"))];
  const shown = list.filter((b) => group === "all" || (b.bundleGroup ?? "Other sets") === group);

  return (
    <>
      <PageHeader
        title="Boxes & sets"
        description="Every box and set, with what it costs you and what you earn. Tap one to see what’s inside. Use the switch to show it in the store or hide it (hidden boxes keep their contents, sales and stock)."
        actions={<ButtonLink href="/admin/products/new?kind=bundle" size="sm"><Plus className="size-4" /> New box</ButtonLink>}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: "cards", label: "List" },
            { value: "matrix", label: "Compare contents" },
          ]}
        />
      </div>
      {bundles.isLoading && <PageLoader />}

      {view === "cards" && (
        <>
          <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
            {[["all", `All (${list.length})`] as const, ...groups.map((g) => [g, `${g} (${list.filter((b) => (b.bundleGroup ?? "Other sets") === g).length})`] as const)].map(([key, label]) => (
              <button key={key} onClick={() => setGroup(key)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm whitespace-nowrap", group === key ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:border-ink")}>
                {label}
              </button>
            ))}
          </div>

          <Card className="divide-y divide-line overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_2rem_auto] gap-3 bg-sky/40 px-4 py-2.5 text-xs font-bold text-ink-soft md:grid">
              <span>Box</span>
              <span className="text-right">Price</span>
              <span className="text-right">You earn</span>
              <span className="text-right">Can pack</span>
              <span />
              <span className="w-[6.5rem]">In store</span>
            </div>
            {shown.map((b) => {
              const profit = b.price - b.componentCost;
              const margin = b.price ? Math.round((profit / b.price) * 100) : 0;
              const visible = b.components.filter((c) => c.visibility === "public");
              const internal = b.components.filter((c) => c.visibility !== "public");
              const isOpen = open === b.id;
              return (
                <div key={b.id}>
                  <div className={cn("flex items-center gap-3 pr-4 hover:bg-sky/30", b.visibility !== "public" && "bg-paper-2/60")}>
                  <button
                    onClick={() => setOpen(isOpen ? null : b.id)}
                    aria-expanded={isOpen}
                    className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 pl-4 text-left md:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_2rem]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-sky">
                        {b.images[0] ? <Media src={b.images[0]} alt="" className="h-full w-full object-cover" /> : <ProductArt name={b.name} seed={b.id} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{adminLabel(b)}</span>
                        {b.adminName && <span className="block truncate text-xs text-ink-soft">Customers see: {b.name}</span>}
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-mute">
                          <span>{visible.length} items</span>
                          {b.visibility !== "public" && <span className="rounded-full bg-line px-1.5 text-ink-soft">Hidden</span>}
                          {b.pinRank != null && <span className="rounded-full bg-haldi-soft px-1.5 text-gold-ink">Pinned #{b.pinRank}</span>}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums md:hidden">
                      <b>{inr(b.price)}</b>
                      <span className={cn("block text-xs", margin < 50 ? "text-gulal" : "text-mor")}>earn {inr(profit)}</span>
                    </span>
                    <span className="hidden text-right tabular-nums md:block">{inr(b.price)}</span>
                    <span className={cn("hidden text-right tabular-nums md:block", margin < 50 ? "text-gulal" : "text-mor")}>
                      {inr(profit)} <span className="text-xs">({margin}%)</span>
                    </span>
                    <span className={cn("hidden text-right tabular-nums md:block", b.available === 0 && "font-bold text-gulal")}>{b.available ?? "No limit"}</span>
                    <ChevronDown className={cn("hidden size-4 justify-self-end text-ink-mute transition-transform md:block", isOpen && "rotate-180")} aria-hidden />
                  </button>
                  <span className="w-[6.5rem] shrink-0">
                    <Toggle
                      checked={b.visibility === "public"}
                      onChange={(on) => quick.mutate({ id: b.id, visibility: on ? "public" : "hidden" })}
                      label={b.visibility === "public" ? "Showing" : "Hidden"}
                    />
                  </span>
                  </div>

                  {isOpen && (
                    <div className="space-y-5 bg-sky/20 px-4 pt-2 pb-5">
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          ["Your cost", inr(b.componentCost), "Items + packing"],
                          ["Worth if bought separately", inr(b.componentValue), "Customer-facing items"],
                          ["Price", inr(b.price), b.mrp ? `MRP ${inr(b.mrp)}` : "No MRP"],
                          ["Can pack now", String(b.available ?? "No limit"), "From current stock"],
                        ].map(([k, v, h]) => (
                          <div key={k} className="rounded-xl bg-paper p-3">
                            <dt className="text-xs text-ink-soft">{k}</dt>
                            <dd className="font-bold tabular-nums">{v}</dd>
                            <dd className="text-xs text-ink-mute">{h}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <p className="label">What the customer gets ({visible.length})</p>
                          <ul className="divide-y divide-line rounded-xl bg-paper text-sm">
                            {visible.map((c) => (
                              <li key={c.productId} className="flex justify-between px-3 py-2"><span>{c.name}</span><span className="text-ink-mute">× {c.qty}</span></li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="label">Packing and delivery ({internal.length})</p>
                          <ul className="divide-y divide-line rounded-xl bg-paper text-sm text-ink-soft">
                            {internal.map((c) => (
                              <li key={c.productId} className="flex justify-between px-3 py-2"><span>{c.name}</span><span className="text-ink-mute">× {c.qty}</span></li>
                            ))}
                            {internal.length === 0 && <li className="px-3 py-2 text-ink-mute">None</li>}
                          </ul>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm text-ink-soft">
                          Pin to top of shop (1 = first)
                          <NumberCell value={b.pinRank} width="w-14" placeholder="—" onSave={(v) => quick.mutate({ id: b.id, pinRank: v && v > 0 ? v : null })} />
                        </span>
                        <div className="flex gap-2">
                          <ButtonLink href={`/admin/analytics/products/${b.id}`} size="sm" variant="outline">See sales</ButtonLink>
                          <ButtonLink href={`/admin/products/${b.id}`} size="sm">Edit box</ButtonLink>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!bundles.isLoading && shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-mute">No boxes here yet.</p>}
          </Card>
        </>
      )}

      {view === "matrix" && (
        <Card className="overflow-x-auto">
          {singles.isLoading ? (
            <div className="p-5"><PageLoader /></div>
          ) : (
            <table className="text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky left-0 z-10 min-w-[220px] bg-paper px-3 py-2 text-left text-xs font-bold text-ink-soft">Product</th>
                  <th className="px-2 py-2 text-right text-xs font-bold text-ink-soft">Cost</th>
                  {list.map((b) => (
                    <th key={b.id} className="h-36 w-10 px-1 align-bottom">
                      <Link href={`/admin/products/${b.id}`} className="block origin-bottom-left translate-x-5 -rotate-45 text-left text-xs font-bold whitespace-nowrap hover:text-royal">{adminLabel(b)}</Link>
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
                            <td className="sticky left-0 z-10 bg-paper px-3 py-1.5"><Link href={`/admin/products/${p.id}`} className="hover:text-royal">{adminLabel(p)}</Link></td>
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
