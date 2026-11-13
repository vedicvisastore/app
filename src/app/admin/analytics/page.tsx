"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { inr } from "@/lib/utils";
import { Card, PageHeader, Stat, Tabs } from "../_ui";
import { IndiaPixelMap } from "./india-map";
import { AnalyticsNav } from "./nav";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "0", label: "All time" },
] as const;

function Ranking({ title, rows, total }: { title: string; rows: { name: string; state?: string; orders: number; revenue: number }[]; total: number }) {
  return (
    <Card className="p-5">
      <h2 className="font-sans text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-mute">No orders in this period.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.slice(0, 10).map((r, i) => {
            const pct = total ? (r.orders / total) * 100 : 0;
            return (
              <li key={`${r.name}-${r.state}-${i}`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-ink-mute tabular-nums">{i + 1}</span>
                    {r.name}
                    {r.state && r.state !== r.name && <span className="text-ink-mute">, {r.state}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <b>{r.orders}</b> <span className="text-ink-mute">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-heat-0">
                  <div className="h-full origin-left rounded-full bg-heat-4" style={{ transform: `scaleX(${pct / 100})` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export default function AnalyticsPage() {
  const trpc = useTRPC();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  const geo = useQuery(trpc.admin.geoAnalytics.queryOptions({ days: Number(range) }));
  const grid = useQuery({ ...trpc.admin.pincodeGrid.queryOptions(), staleTime: Infinity, gcTime: Infinity });
  const d = geo.data;

  return (
    <>
      <AnalyticsNav />
      <PageHeader title="Where orders come from" description="Paid orders by delivery pincode. Scroll or click the map to zoom into a region, drag to move around, and hover a square for its towns." />
      <div className="mb-4 max-w-md">
        <Tabs value={range} onChange={setRange} items={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={d?.total ?? "…"} tone="royal" />
        <Stat label="Revenue" value={d ? inr(d.revenue) : "…"} />
        <Stat label="States reached" value={d?.states.filter((s) => s.name !== "Unknown").length ?? "…"} hint={d?.states[0] ? `Most from ${d.states[0].name}` : undefined} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden p-3">
          {grid.data && d ? <IndiaPixelMap grid={grid.data} points={d.points} total={d.total} /> : <div className="grid h-[600px] place-items-center"><Spinner className="text-ink-mute" /></div>}
          {d && d.unmapped > 0 && <p className="px-2 pt-2 text-xs text-ink-mute">{d.unmapped} orders have pincodes that aren’t in the India Post directory, so they’re counted but not on the map.</p>}
        </Card>
        <div className="space-y-6">
          <Ranking title="Top states" rows={d?.states ?? []} total={d?.total ?? 0} />
          <Ranking title="Top cities and districts" rows={d?.districts ?? []} total={d?.total ?? 0} />
        </div>
      </div>
      <p className="mt-6 text-xs text-ink-mute">Pincode locations: All India Pincode Directory, Department of Posts, via data.gov.in (Open Government Data Licence, India).</p>
    </>
  );
}
