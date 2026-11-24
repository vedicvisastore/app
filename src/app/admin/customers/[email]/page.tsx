"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Mail, MapPin, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { StatusPill } from "@/app/(store)/account/status-pill";
import { PageLoader } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { formatDate, inr, ORDER_STATUS_LABEL } from "@/lib/utils";
import { Card, PageHeader, Stat, useToast } from "../../_ui";

type OrderRow = { id: number; number: string; status: string; total: number; createdAt: Date | string; trackingNumber: string | null; items: { qty: number; name: string }[] };

export default function CustomerPage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = use(params);
  const trpc = useTRPC();
  const toast = useToast();
  const { data: c, isLoading, error } = useQuery(trpc.admin.customer.queryOptions({ email: decodeURIComponent(email) }));

  if (error) return <p className="text-ink-soft">{error.message}</p>;
  if (isLoading || !c) return <PageLoader />;
  const a = c.latestAddress;

  return (
    <>
      <Link href="/admin/customers" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-royal">
        <ArrowLeft className="size-4" /> Customers
      </Link>
      <PageHeader
        title={c.name ?? c.email}
        description={c.account ? `Has an account since ${formatDate(c.account.joined)}${c.account.role === "admin" ? " · admin" : ""}` : "Guest: ordered without an account"}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders" value={c.stats.orders} hint={c.open.length ? `${c.open.length} still on the way` : "None open"} />
        <Stat label="Spent" value={inr(c.stats.spent)} tone="mor" />
        <Stat label="Average order" value={inr(c.stats.average)} />
        <Stat label="Last order" value={c.stats.lastOrder ? formatDate(c.stats.lastOrder) : "Never"} hint={c.stats.firstOrder ? `First ${formatDate(c.stats.firstOrder)}` : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-sans text-lg font-bold">Contact</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-ink-mute" aria-hidden />
                <a href={`mailto:${c.email}`} className="min-w-0 flex-1 truncate text-royal">{c.email}</a>
                <button type="button" className="text-ink-mute hover:text-royal" aria-label="Copy email" onClick={() => navigator.clipboard.writeText(c.email).then(() => toast("Email copied"))}>
                  <Copy className="size-4" />
                </button>
              </li>
              {c.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 text-ink-mute" aria-hidden />
                  <a href={`tel:${c.phone}`} className="flex-1 text-royal">{c.phone}</a>
                  <a href={`https://wa.me/91${c.phone.replace(/\D/g, "").slice(-10)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-mor">WhatsApp</a>
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <UserRound className="size-4 text-ink-mute" aria-hidden />
                <span>{c.account ? "Account holder" : "Guest checkout"}</span>
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-sans text-lg font-bold">Addresses</h2>
            {c.addresses.length === 0 && !a && <p className="text-sm text-ink-mute">No address yet.</p>}
            <ul className="space-y-3">
              {(c.addresses.length ? c.addresses : a ? [{ ...a, id: 0, isDefault: true }] : []).map((ad) => (
                <li key={ad.id} className="flex gap-2.5 rounded-xl bg-paper-2 p-3 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-mute" aria-hidden />
                  <span>
                    <b>{ad.name}</b>
                    {ad.isDefault && c.addresses.length > 0 && <span className="ml-2 rounded-full bg-sky px-1.5 text-xs text-royal">Default</span>}
                    <br />
                    {ad.line1}
                    {ad.line2 ? `, ${ad.line2}` : ""}
                    <br />
                    {ad.city}, {ad.state} {ad.pincode}
                  </span>
                </li>
              ))}
            </ul>
            {!c.addresses.length && a && <p className="mt-2 text-xs text-ink-mute">From their latest order.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <OrderList title="Current orders" empty="Nothing on the way right now." list={c.open} />
          <OrderList title="Past orders" empty="No past orders." list={c.past} />
        </div>
      </div>
    </>
  );
}

function OrderList({ title, empty, list }: { title: string; empty: string; list: OrderRow[] }) {
  return (
    <Card>
      <h2 className="border-b border-line px-5 py-3 font-sans text-lg font-bold">
        {title} <span className="text-sm font-normal text-ink-mute">({list.length})</span>
      </h2>
      {list.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-mute">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-sky/40">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="text-royal">{o.number}</b>
                    <StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL]} />
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-soft">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span>
                  <span className="text-xs text-ink-mute">
                    {formatDate(o.createdAt, true)}
                    {o.trackingNumber && ` · ${o.trackingNumber}`}
                  </span>
                </span>
                <b className="shrink-0 tabular-nums">{inr(o.total)}</b>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
