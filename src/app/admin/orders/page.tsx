"use client";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { StatusPill } from "@/app/(store)/account/status-pill";
import { Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { formatDate, inr, ORDER_STATUS_LABEL } from "@/lib/utils";
import { Card, PageHeader, Tabs, td, th } from "../_ui";

const STATUS_TABS = ["all", "paid", "packed", "shipped", "delivered", "cancelled", "pending_payment"] as const;
type S = (typeof STATUS_TABS)[number];

function Orders() {
  const trpc = useTRPC();
  const router = useRouter();
  const params = useSearchParams();
  const status = (STATUS_TABS.find((s) => s === params.get("status")) ?? "all") as S;
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery(
    trpc.admin.orders.queryOptions({ status: status === "all" ? undefined : status, q: q.trim() || undefined }),
  );
  const dash = useQuery(trpc.admin.dashboard.queryOptions());
  const counts = dash.data?.byStatus ?? {};

  return (
    <>
      <PageHeader title="Orders" description="Pack paid orders, then add the India Post tracking number when you hand them over. Customers see every update on their order page." />
      <Card>
        <div className="px-4 pt-2">
          <Tabs<S>
            value={status}
            onChange={(v) => router.replace(v === "all" ? "/admin/orders" : `/admin/orders?status=${v}`)}
            items={STATUS_TABS.map((s) => ({ value: s, label: s === "all" ? "All" : s === "paid" ? "To pack" : s === "packed" ? "To ship" : s === "pending_payment" ? "Unpaid" : ORDER_STATUS_LABEL[s], count: s === "all" ? undefined : counts[s] }))}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <Search className="size-4 text-ink-mute" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order number, name, phone, email or tracking number" className="h-9 flex-1 bg-transparent text-sm outline-none" aria-label="Search orders" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-line bg-sky/40"><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Items</th><th className={th}>Status</th><th className={th}>Tracking</th><th className={`${th} text-right`}>Total</th></tr></thead>
            <tbody>
              {isLoading && <tr><td className={td} colSpan={6}><Spinner className="text-ink-mute" /></td></tr>}
              {data?.length === 0 && <tr><td className={`${td} py-10 text-center text-ink-mute`} colSpan={6}>No orders here.</td></tr>}
              {data?.map((o) => (
                <tr key={o.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-sky/40" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                  <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-bold text-royal" onClick={(e) => e.stopPropagation()}>{o.number}</Link><p className="text-xs text-ink-mute">{formatDate(o.createdAt, true)}</p></td>
                  <td className={td}>{o.shippingAddress.name}<p className="text-xs text-ink-mute">{o.shippingAddress.phone}, {o.shippingAddress.pincode}</p></td>
                  <td className={`${td} max-w-[260px]`}><p className="truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p></td>
                  <td className={td}><StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status]} /></td>
                  <td className={`${td} font-mono text-xs`}>{o.trackingNumber ?? <span className="text-ink-mute">—</span>}</td>
                  <td className={`${td} text-right font-bold tabular-nums`}>{inr(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}
