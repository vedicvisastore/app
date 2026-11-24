"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpToLine, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink, Media, ProductArt, Spinner , PageLoader } from "@/components/ui";
import { Select } from "@/components/select";
import type { Visibility } from "@/db/schema";
import { useTRPC } from "@/lib/trpc/client";
import { adminLabel, cn, inr } from "@/lib/utils";
import { Card, ConfirmButton, NumberCell, PageHeader, Pagination, Tabs, td, th, usePaged, useToast } from "../_ui";

type Tab = "all" | "public" | "hidden" | "internal" | "pinned";

const VIS_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "public", label: "In store" },
  { value: "hidden", label: "Hidden" },
  { value: "internal", label: "Packing / internal" },
];

export default function ProductsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery(trpc.admin.products.queryOptions({ kind: "single" }));
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.admin.products.queryKey() });
  const quick = useMutation(trpc.admin.quickUpdate.mutationOptions({ onSuccess: () => { invalidate(); toast("Saved"); }, onError: (e) => toast(e.message, "error") }));
  const del = useMutation(trpc.admin.deleteProduct.mutationOptions({ onSuccess: () => { invalidate(); toast("Product deleted"); }, onError: (e) => toast(e.message, "error") }));

  const all = data ?? [];
  const list = all
    .filter((p) => (tab === "all" ? true : tab === "pinned" ? p.pinRank != null : p.visibility === tab))
    .filter((p) => !q || `${p.name} ${p.adminName ?? ""} ${p.sku} ${p.categoryName ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const paged = usePaged(list, `${tab}|${q}`);
  const count = (t: Tab) => all.filter((p) => (t === "pinned" ? p.pinRank != null : p.visibility === t)).length;

  return (
    <>
      <PageHeader
        title="Products"
        description="Single items. Edit stock, pin rank and boost right in the table; changes save when you leave the cell."
        actions={<ButtonLink href="/admin/products/new" size="sm"><Plus className="size-4" /> Add product</ButtonLink>}
      />
      <Card>
        <div className="px-4 pt-2">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { value: "all", label: "All", count: all.length },
              { value: "public", label: "In store", count: count("public") },
              { value: "pinned", label: "Pinned to top", count: count("pinned") },
              { value: "hidden", label: "Hidden", count: count("hidden") },
              { value: "internal", label: "Packing & delivery", count: count("internal") },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <Search className="size-4 text-ink-mute" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU or category" className="h-9 flex-1 bg-transparent text-sm outline-none" aria-label="Search products" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-sky/40">
                <th className={th}>Product</th><th className={th}>Category</th><th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Cost</th><th className={`${th} text-right`}>Margin</th>
                <th className={th}>Stock</th>
                <th className={th} title="Lower number shows first in the shop. Leave empty for automatic (trending) order.">Pin</th>
                <th className={th} title="Added to the trending score. Use to nudge without pinning.">Boost</th>
                <th className={th}>Visibility</th><th className={th} />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className={td} colSpan={10}><PageLoader /></td></tr>}
              {!isLoading && list.length === 0 && <tr><td className={`${td} py-10 text-center text-ink-mute`} colSpan={10}>No products match.</td></tr>}
              {paged.rows.map((p) => {
                const margin = p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sky/30">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-sky">{p.images[0] ? <Media src={p.images[0]} alt="" className="h-full w-full object-cover" /> : <ProductArt name={p.name} seed={p.id} className="[&_span]:text-base" />}</div>
                        <div className="min-w-0">
                          <Link href={`/admin/products/${p.id}`} className="font-bold hover:text-royal">{adminLabel(p)}</Link>
                          {p.adminName && <p className="text-xs text-ink-soft">Customers see: {p.name}</p>}
                          <p className="text-xs text-ink-mute">{p.comingSoon && <span className="mr-1.5 rounded-full bg-gold-soft px-1.5 py-0.5 font-bold text-gold-ink">Launching soon</span>}{p.sku}{p.inBundles.length > 0 && `, in ${p.inBundles.length} ${p.inBundles.length === 1 ? "box" : "boxes"}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} text-ink-soft`}>{p.categoryName ?? "—"}</td>
                    <td className={`${td} text-right tabular-nums`}>{inr(p.price)}{p.mrp && <s className="ml-1 text-xs text-ink-mute">{inr(p.mrp)}</s>}</td>
                    <td className={`${td} text-right text-ink-soft tabular-nums`}>{inr(p.cost)}</td>
                    <td className={cn(td, "text-right tabular-nums", margin < 40 ? "text-gulal" : "text-mor")}>{margin}%</td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <NumberCell value={p.stock} placeholder="∞" onSave={(v) => quick.mutate({ id: p.id, stock: v })} />
                        <Link href={`/admin/stock/${p.id}`} className="text-xs font-bold text-royal">Ledger</Link>
                      </div>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-1">
                        <NumberCell value={p.pinRank} placeholder="—" width="w-12" onSave={(v) => quick.mutate({ id: p.id, pinRank: v && v > 0 ? v : null })} />
                        {p.pinRank == null && p.visibility === "public" && (
                          <button title="Pin to top" onClick={() => quick.mutate({ id: p.id, pinRank: 1 })} className="grid size-7 place-items-center rounded-lg text-ink-mute hover:bg-sky hover:text-royal"><ArrowUpToLine className="size-3.5" /></button>
                        )}
                      </div>
                    </td>
                    <td className={td}><NumberCell value={p.boost} width="w-14" onSave={(v) => quick.mutate({ id: p.id, boost: v ?? 0 })} /></td>
                    <td className={td}>
                      <Select look="compact" aria-label={`Visibility of ${p.name}`} value={p.visibility} onChange={(v: Visibility) => quick.mutate({ id: p.id, visibility: v })} menuMinWidth={180} options={VIS_OPTIONS} />
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <Link href={`/admin/products/${p.id}`} className="mr-3 font-bold text-royal">Edit</Link>
                      <ConfirmButton onConfirm={() => del.mutate({ id: p.id })} confirmLabel="Delete" className="font-bold text-ink-mute hover:text-gulal">Delete</ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...paged.bar} noun="products" />
      </Card>
    </>
  );
}
