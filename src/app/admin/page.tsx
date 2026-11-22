"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { StatusPill } from "@/app/(store)/account/status-pill";
import { Spinner , PageLoader } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { formatDate, inr, ORDER_STATUS_LABEL } from "@/lib/utils";
import { Card, PageHeader, Stat, td, th } from "./_ui";

export default function Dashboard() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.admin.dashboard.queryOptions());
  if (isLoading || !data) return <PageLoader />;
  const toPack = data.byStatus.paid ?? 0;
  const toShip = data.byStatus.packed ?? 0;

  return (
    <>
      <PageHeader title="Dashboard" description="Today at a glance. Revenue counts paid orders that aren't cancelled or refunded." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue today" value={inr(data.today.total)} hint={`${data.today.orders} ${data.today.orders === 1 ? "order" : "orders"}`} tone="royal" />
        <Stat label="Last 7 days" value={inr(data.week.total)} hint={`${data.week.orders} ${data.week.orders === 1 ? "order" : "orders"}`} />
        <Stat label="Last 30 days" value={inr(data.month.total)} hint={`${data.month.orders} ${data.month.orders === 1 ? "order" : "orders"}`} />
        <Link href="/admin/orders?status=paid">
          <Stat label="Waiting to be packed" value={toPack} hint={toShip ? `${toShip} packed, waiting for India Post` : "Open the packing queue"} tone={toPack ? "gulal" : "mor"} />
        </Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="font-sans text-lg font-bold">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-bold text-royal">All orders</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead><tr className="border-b border-line"><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th></tr></thead>
              <tbody>
                {data.recent.length === 0 && <tr><td className={`${td} text-ink-mute`} colSpan={4}>No orders yet. They'll show up here as soon as someone pays.</td></tr>}
                {data.recent.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-sky/40">
                    <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-bold text-royal">{o.number}</Link><p className="text-xs text-ink-mute">{formatDate(o.createdAt, true)}</p></td>
                    <td className={td}>{o.shippingAddress.name}<p className="text-xs text-ink-mute">{o.shippingAddress.city}, {o.shippingAddress.pincode}</p></td>
                    <td className={td}><StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status]} /></td>
                    <td className={`${td} text-right font-bold tabular-nums`}>{inr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Best sellers, 30 days</h2>
            {data.top.length === 0 ? <p className="mt-2 text-sm text-ink-mute">No sales yet.</p> : (
              <ol className="mt-3 space-y-2 text-sm">
                {data.top.map((t, i) => (
                  <li key={t.name} className="flex items-baseline gap-3">
                    <span className="w-4 text-ink-mute tabular-nums">{i + 1}</span>
                    <span className="flex-1">{t.name}</span>
                    <span className="text-ink-soft tabular-nums">{t.qty} sold</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-lg font-bold">Low stock</h2>
              <Link href="/admin/products" className="text-sm font-bold text-royal">Update stock</Link>
            </div>
            {data.lowStock.length === 0 ? <p className="mt-2 text-sm text-ink-mute">Everything has more than 5 units.</p> : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {data.lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <Link href={`/admin/stock/${p.id}`} className="hover:text-royal">{p.name}{p.visibility === "internal" && <span className="ml-1 text-xs text-ink-mute">(packing)</span>}</Link>
                    <span className={p.stock === 0 ? "font-bold text-gulal" : "font-bold text-gold-ink"}>{p.stock} left</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
