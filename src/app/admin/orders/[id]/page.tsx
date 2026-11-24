"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { StatusPill } from "@/app/(store)/account/status-pill";
import { Button, Spinner , PageLoader } from "@/components/ui";
import { Select } from "@/components/select";
import type { OrderStatus } from "@/db/schema";
import { PRIMARY_ACTION } from "@/lib/order-machine";
import { useTRPC } from "@/lib/trpc/client";
import { customerHref, formatDate, INDIA_POST_TRACK_URL, inr, ORDER_STATUS_LABEL } from "@/lib/utils";
import { Card, Field, PageHeader, useToast } from "../../_ui";


export default function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: o, isLoading } = useQuery(trpc.admin.order.queryOptions({ id: Number(id) }));
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [loc, setLoc] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [restock, setRestock] = useState(true);

  useEffect(() => {
    if (o) {
      setTracking(o.trackingNumber ?? "");
      setNote(o.adminNote ?? "");
    }
  }, [o]);

  const update = useMutation(
    trpc.admin.updateOrder.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.admin.order.queryKey({ id: Number(id) }) });
        qc.invalidateQueries({ queryKey: trpc.admin.orders.queryKey() });
        toast("Order updated");
        setMsg("");
        setLoc("");
        setStatus("");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  if (isLoading || !o) return <PageLoader />;
  const a = o.shippingAddress;
  const primary = PRIMARY_ACTION[o.status];
  // Only offer the primary move if the state machine allows it for admins (it also hides "Mark as paid" on paid orders, etc.)
  const next = primary && o.allowedNext.includes(primary.to) && primary.to !== "paid" ? { status: primary.to, label: primary.label } : null;
  const needsTracking = next?.status === "shipped" && !tracking.trim();
  const label = `${a.name}\n${a.line1}${a.line2 ? `, ${a.line2}` : ""}${a.landmark ? `\nNear ${a.landmark}` : ""}\n${a.city}, ${a.state} - ${a.pincode}\nPh: ${a.phone}`;

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-royal"><ArrowLeft className="size-4" /> Orders</Link>
      <PageHeader
        title={`Order ${o.number}`}
        description={`Placed ${formatDate(o.createdAt, true)}${o.paidAt ? `, paid ${formatDate(o.paidAt, true)}` : ""}`}
        actions={<StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status]} className="!text-sm" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Fulfilment */}
          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Fulfil</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="India Post tracking number" hint="Speed Post numbers look like EE123456789IN">
                <input value={tracking} onChange={(e) => setTracking(e.target.value.toUpperCase())} className="field font-mono tracking-wider" placeholder="EE123456789IN" />
              </Field>
              <Button variant="outline" disabled={update.isPending || tracking.trim() === (o.trackingNumber ?? "")} onClick={() => update.mutate({ id: o.id, trackingNumber: tracking.trim() || null })}>
                Save tracking
              </Button>
            </div>
            {next && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-sky p-4">
                <p className="flex-1 text-sm text-ink-soft">
                  {next.status === "packed" && "Packed everything on the pick list below?"}
                  {next.status === "shipped" && (needsTracking ? "Add the tracking number first, then mark it shipped. The customer gets an email with it." : "Handed to India Post? The customer gets an email with the tracking number.")}
                  {next.status === "delivered" && "India Post shows it delivered?"}
                </p>
                <Button disabled={update.isPending || needsTracking} onClick={() => update.mutate({ id: o.id, status: next.status, trackingNumber: tracking.trim() || undefined })}>
                  {update.isPending && <Spinner />} {next.label}
                </Button>
              </div>
            )}
            {o.trackingNumber && (
              <a href={INDIA_POST_TRACK_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-royal">
                Open India Post tracking <ExternalLink className="size-3.5" />
              </a>
            )}
          </Card>

          {/* Pick list */}
          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Pick list</h2>
            <p className="text-sm text-ink-soft">Boxes are expanded into every item and packing material that goes in them.</p>
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {o.pickList.map((p) => (
                <li key={p.name} className="flex justify-between border-b border-dashed border-line py-1">
                  <span>{p.name}</span>
                  <span className="font-bold tabular-nums">× {p.qty}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Items */}
          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Items ordered</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1">{it.name} <span className="text-ink-mute">({it.sku})</span></span>
                  <span className="text-ink-soft tabular-nums">{it.qty} × {inr(it.unitPrice)}</span>
                  <span className="w-20 text-right font-bold tabular-nums">{inr(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular-nums">{inr(o.subtotal)}</dd></div>
              {o.discountLines.map((d) => <div key={d.id} className="flex justify-between text-mor"><dt>{d.label}</dt><dd className="tabular-nums">−{inr(d.amount)}</dd></div>)}
              <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd className="tabular-nums">{inr(o.shippingFee)}</dd></div>
              <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{inr(o.total)}</dd></div>
              {o.razorpayPaymentId && <p className="pt-1 text-xs text-ink-mute">Razorpay payment {o.razorpayPaymentId}</p>}
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Who this is: their profile and their other orders, so repeat customers are recognised */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-sans text-lg font-bold">Customer</h2>
                <p className="truncate text-sm">
                  <b>{o.customer?.name ?? a.name}</b>
                  <span className="text-ink-soft"> · {o.email}</span>
                </p>
                <p className="text-xs text-ink-mute">
                  {o.customer ? `Account since ${formatDate(o.customer.createdAt)}` : "Guest checkout"} · {o.customerTotals.orders} {o.customerTotals.orders === 1 ? "order" : "orders"} · {inr(o.customerTotals.spent)} spent
                </p>
              </div>
              <Link href={customerHref(o.email)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-bold text-royal hover:border-royal">
                Profile
              </Link>
            </div>
            {o.otherOrders.length > 0 ? (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
                {o.otherOrders.map((x) => (
                  <li key={x.id}>
                    <Link href={`/admin/orders/${x.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-sky/40">
                      <b className="text-royal">{x.number}</b>
                      <StatusPill status={x.status} label={ORDER_STATUS_LABEL[x.status]} />
                      <span className="ml-auto text-xs text-ink-mute">{formatDate(x.createdAt)}</span>
                      <b className="w-16 text-right tabular-nums">{inr(x.total)}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold-ink">First order from this customer.</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-lg font-bold">Ship to</h2>
              <button className="inline-flex items-center gap-1 text-sm font-bold text-royal" onClick={() => navigator.clipboard.writeText(label).then(() => toast("Address copied"))}>
                <Copy className="size-3.5" /> Copy label
              </button>
            </div>
            <pre className="mt-3 font-sans text-sm leading-relaxed whitespace-pre-wrap">{label}</pre>
            <p className="mt-3 text-xs text-ink-mute">{o.email}{o.customer?.name && o.customer.name !== a.name ? `, account: ${o.customer.name}` : ""}</p>
          </Card>

          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Post an update</h2>
            <p className="text-sm text-ink-soft">Shows on the customer's order timeline.</p>
            <div className="mt-3 space-y-3">
              <Field label="Message"><input value={msg} onChange={(e) => setMsg(e.target.value)} className="field" placeholder="Reached Mathura sorting hub" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Location (optional)"><input value={loc} onChange={(e) => setLoc(e.target.value)} className="field" /></Field>
                <Field label="Change status (optional)">
                  <Select
                    value={status}
                    onChange={(v) => setStatus(v as OrderStatus | "")}
                    disabled={!o.allowedNext.length}
                    placeholder={o.allowedNext.length ? `Keep ${ORDER_STATUS_LABEL[o.status].toLowerCase()}` : "Final status, can't change"}
                    options={[{ value: "", label: `Keep ${ORDER_STATUS_LABEL[o.status].toLowerCase()}` }, ...o.allowedNext.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))]}
                  />
                </Field>
              </div>
              {(status === "cancelled" || status === "refunded") && o.paidAt && o.status !== "pending_payment" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4 accent-royal" />
                  Put the items back in stock (recorded in each product's ledger)
                </label>
              )}
              <Button size="sm" disabled={update.isPending || (!msg.trim() && !status)} onClick={() => update.mutate({ id: o.id, message: msg.trim() || undefined, location: loc.trim() || undefined, status: status || undefined, restock: (status === "cancelled" || status === "refunded") && restock })}>
                Post update
              </Button>
              {(status === "cancelled" || status === "refunded") && <p className="text-xs text-gulal">This doesn't move money. Issue the refund from the Razorpay dashboard.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Timeline</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">
              {o.events.map((e) => (
                <li key={e.id}>
                  <p>{e.message}</p>
                  <p className="text-xs text-ink-mute">{formatDate(e.createdAt, true)}{e.location && `, ${e.location}`}, by {e.source}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <Field label="Private note (only admins see this)">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="field" />
            </Field>
            <Button size="sm" variant="outline" className="mt-2" disabled={update.isPending || note === (o.adminNote ?? "")} onClick={() => update.mutate({ id: o.id, adminNote: note })}>
              Save note
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
