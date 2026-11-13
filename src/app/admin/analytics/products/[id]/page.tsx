"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import { Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { formatDate, inr } from "@/lib/utils";
import { Card, Stat, Tabs } from "../../../_ui";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "0", label: "All time" },
];

export default function ProductAnalyticsDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const trpc = useTRPC();
  const router = useRouter();
  const sp = useSearchParams();
  const range = RANGES.some((r) => r.value === sp.get("days")) ? sp.get("days")! : "30";
  const { data: d, isLoading, error } = useQuery(trpc.admin.productAnalyticsDetail.queryOptions({ id: Number(id), days: Number(range) }));

  if (isLoading) return <Spinner className="text-ink-mute" />;
  if (error || !d) return <p className="text-ink-soft">{error?.message ?? "Not found"}</p>;
  const maxUnits = Math.max(1, ...d.series.map((w) => w.units));
  const stateTotal = d.states.reduce((s, r) => s + r.units, 0);
  const conversion = d.product.views ? (d.orders / d.product.views) * 100 : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/admin/analytics/products?days=${range}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All products
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-paper-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.product.image && <img src={d.product.image} alt="" className="size-full object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl sm:text-4xl">{d.product.name}</h1>
          <p className="text-sm text-ink-soft">
            {d.product.kind === "bundle" ? "Box / set" : "Single item"} · sells at {inr(d.product.price)} · costs {inr(d.unitCost)}
            {d.product.stock != null && ` · ${d.product.stock} in stock`}
          </p>
        </div>
        <Link href={`/admin/products/${d.product.id}`} className="rounded-full border border-line px-4 py-2 text-sm font-bold">
          Edit product
        </Link>
      </div>
      <div className="mb-6">
        <Tabs value={range} onChange={(v) => router.replace(`?days=${v}`)} items={RANGES} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={inr(d.sales)} hint="Before coupons and offers" />
        <Stat label="Units sold" value={d.units} hint={`in ${d.orders} ${d.orders === 1 ? "order" : "orders"}`} />
        <Stat label="Profit" value={inr(d.profit)} tone={d.profit >= 0 ? "mor" : "gulal"} hint="At today’s cost" />
        <Stat label="Page views" value={d.product.views} hint={conversion != null ? `${conversion.toFixed(1)}% of views became orders (all time views)` : "Counted roughly, 1 in 10"} />
      </div>

      <Card className="mt-5 p-5">
        <h2 className="font-sans text-lg font-bold">Units sold per week</h2>
        <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label="Weekly units sold">
          {d.series.map((w) => (
            <div key={w.week} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="rounded-t-md bg-royal transition-colors group-hover:bg-gold" style={{ height: `${(w.units / maxUnits) * 100}%`, minHeight: w.units ? 4 : 1 }} />
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-0.5 text-xs whitespace-nowrap text-white group-hover:block">
                {w.units} · {inr(w.sales)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-mute">
          <span>Week of {formatDate(d.series[0]?.week)}</span>
          <span>This week</span>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-sans text-lg font-bold">Where it goes</h2>
          {d.states.length === 0 ? (
            <p className="mt-2 text-sm text-ink-mute">No orders in this period.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {d.states.map((s) => (
                <li key={s.state}>
                  <div className="flex justify-between text-sm">
                    <span>{s.state}</span>
                    <b className="tabular-nums">{s.units}</b>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-peacock" style={{ width: `${(s.units / stateTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-sans text-lg font-bold">Latest orders</h2>
          {d.recent.length === 0 ? (
            <p className="mt-2 text-sm text-ink-mute">No orders in this period.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {d.recent.map((o) => (
                <li key={`${o.id}-${o.qty}`}>
                  <Link href={`/admin/orders/${o.id}`} className="flex justify-between gap-3 py-2.5 text-sm hover:text-royal">
                    <span>
                      <b>{o.number}</b> <span className="text-ink-mute">· {o.city} · {formatDate(o.paidAt)}</span>
                    </span>
                    <span className="tabular-nums">
                      {o.qty} × · {inr(o.lineTotal)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {d.product.kind === "single" && (
        <Card className="mt-5 p-5">
          <h2 className="font-sans text-lg font-bold">Sent inside boxes</h2>
          {d.boxes.length === 0 ? (
            <p className="mt-2 text-sm text-ink-mute">Not sent inside any box in this period.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {d.boxes.map((b) => (
                <li key={b.name} className="flex justify-between py-2.5">
                  <span>{b.name}</span>
                  <b className="tabular-nums">{b.units} units</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
