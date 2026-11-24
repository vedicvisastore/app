"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Spinner , PageLoader } from "@/components/ui";
import { Select } from "@/components/select";
import { useTRPC } from "@/lib/trpc/client";
import { cn, inr } from "@/lib/utils";
import { Card, PageHeader, Stat, Tabs } from "../../_ui";
import { AnalyticsNav } from "../nav";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "0", label: "All time" },
];

const SORTS = [
  { key: "sales", label: "Sales" },
  { key: "units", label: "Units sold" },
  { key: "profit", label: "Profit" },
  { key: "views", label: "Views" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

export default function ProductAnalyticsPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const sp = useSearchParams();
  const range = RANGES.some((r) => r.value === sp.get("days")) ? sp.get("days")! : "30";
  const [sort, setSort] = useState<SortKey>("sales");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "bundle" | "single">("all");
  const { data, isLoading } = useQuery(trpc.admin.productAnalytics.queryOptions({ days: Number(range) }));

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => (kind === "all" || p.kind === kind) && (!t || p.name.toLowerCase().includes(t)))
      .sort((a, b) => b[sort] - a[sort]);
  }, [data, q, kind, sort]);

  const totals = (data ?? []).reduce((s, p) => ({ sales: s.sales + p.sales, units: s.units + p.units, profit: s.profit + p.profit }), { sales: 0, units: 0, profit: 0 });
  const best = (data ?? []).find((p) => p.units > 0);
  const neverSold = (data ?? []).filter((p) => p.units === 0 && p.visibility === "public").length;
  const max = Math.max(1, ...rows.map((r) => r[sort]));

  return (
    <>
      <AnalyticsNav />
      <PageHeader title="Product performance" description="How each product sells. Tap a product for its weekly sales, where it goes and which orders it was in." />
      <div className="mb-6">
        <Tabs value={range} onChange={(v) => router.replace(`?days=${v}`)} items={RANGES} />
      </div>

      {isLoading && <PageLoader />}
      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sales" value={inr(totals.sales)} hint="Before coupons and offers" />
            <Stat label="Units sold" value={totals.units} />
            <Stat label="Profit" value={inr(totals.profit)} tone={totals.profit >= 0 ? "mor" : "gulal"} hint="At today’s cost" />
            <Stat label="Best seller" value={<span className="block truncate text-lg">{best?.name ?? "—"}</span>} hint={neverSold ? `${neverSold} live products haven’t sold yet` : undefined} />
          </div>

          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="flex h-10 min-w-0 flex-1 basis-56 items-center gap-2 rounded-full border border-line px-3 focus-within:border-royal">
                <Search className="size-4 text-ink-mute" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a product" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </label>
              <Select
                look="pill"
                aria-label="Type"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: "Boxes and items" },
                  { value: "bundle", label: "Boxes and sets only" },
                  { value: "single", label: "Single items only" },
                ]}
              />
              <Select look="pill" aria-label="Sort by" value={sort} onChange={setSort} menuMinWidth={180} options={SORTS.map((s) => ({ value: s.key, label: `Sort: ${s.label}` }))} />
            </div>

            <div className="hidden grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,1fr))_1.5rem] gap-3 border-b border-line px-2 pb-2 text-xs font-bold text-ink-soft md:grid">
              <span>Product</span>
              <span className="text-right">Sales</span>
              <span className="text-right">Units</span>
              <span className="text-right">Profit</span>
              <span className="text-right">Views</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/analytics/products/${p.id}?days=${range}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-3 hover:bg-sky/40 md:grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,1fr))_1.5rem]">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-paper-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image && <img src={p.image} alt="" className="size-full object-cover" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{p.name}</span>
                        <span className="block text-xs text-ink-mute">
                          {p.kind === "bundle" ? "Box / set" : "Item"}
                          {p.unitsInBoxes > 0 && ` · ${p.unitsInBoxes} more inside boxes`}
                          {p.visibility === "hidden" && " · hidden"}
                        </span>
                        <span className="mt-1 block h-1 w-full max-w-48 overflow-hidden rounded-full bg-line md:hidden">
                          <span className="block h-full rounded-full bg-royal" style={{ width: `${Math.max(0, (p[sort] / max) * 100)}%` }} />
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums md:hidden">
                      <b>{inr(p.sales)}</b>
                      <span className="block text-xs text-ink-mute">{p.units} sold</span>
                    </span>
                    <span className="hidden text-right tabular-nums md:block">{inr(p.sales)}</span>
                    <span className="hidden text-right tabular-nums md:block">{p.units}</span>
                    <span className={cn("hidden text-right tabular-nums md:block", p.profit < 0 && "text-gulal")}>{inr(p.profit)}</span>
                    <span className="hidden text-right text-ink-soft tabular-nums md:block">{p.views}</span>
                    <ChevronRight className="hidden size-4 text-ink-mute md:block" aria-hidden />
                  </Link>
                </li>
              ))}
              {rows.length === 0 && <li className="py-10 text-center text-sm text-ink-mute">No products match.</li>}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
