import { TRPCError } from "@trpc/server";
import { Check, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container, Media, ProductArt } from "@/components/ui";
import { cn, formatDate, INDIA_POST_TRACK_URL, inr, ORDER_STATUS_LABEL } from "@/lib/utils";
import { api } from "@/server/caller";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Order details" };

const STEPS = ["paid", "packed", "shipped", "delivered"] as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { number } = await params;
  const { placed } = await searchParams;
  const trpc = await api();
  const me = await trpc.auth.me();
  if (!me) redirect(`/login?next=/account/orders/${number}`);
  const o = await trpc.account.order({ number }).catch((e) => {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!o) notFound();

  const stepIdx = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const cancelled = o.status === "cancelled" || o.status === "refunded";
  const a = o.shippingAddress;

  return (
    <Container className="max-w-4xl pt-10">
      {placed && o.status !== "pending_payment" && (
        <div className="mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-sky to-mor-soft p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-mor text-white">
            <Check className="size-7" />
          </div>
          <h1 className="mt-4 text-[length:var(--text-display-s)]">Thank you, your order is placed</h1>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            A confirmation is on its way to {o.email}. Your India Post tracking number will appear here, and in your inbox, the day it ships.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/account" className="text-sm font-bold text-ink-soft hover:text-royal">Your orders</Link>
          <h2 className="mt-1 text-4xl">Order {o.number}</h2>
          <p className="text-sm text-ink-soft">Placed {formatDate(o.createdAt, true)}</p>
        </div>
        <p className="text-lg font-bold">{ORDER_STATUS_LABEL[o.status]}</p>
      </div>

      {!cancelled && o.status !== "pending_payment" && (
        <ol className="mt-8 grid grid-cols-4" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} className="relative flex flex-col items-center text-center">
              {i > 0 && <span className={cn("absolute top-3.5 right-1/2 h-0.5 w-full", i <= stepIdx ? "bg-mor" : "bg-line")} aria-hidden />}
              <span className={cn("relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-bold", i <= stepIdx ? "border-mor bg-mor text-white" : "border-line bg-paper text-ink-mute")}>
                {i <= stepIdx ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("mt-2 text-xs font-bold sm:text-sm", i <= stepIdx ? "text-ink" : "text-ink-mute")}>{ORDER_STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      )}

      {o.trackingNumber && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-sky/50 p-5">
          <div>
            <p className="text-sm text-ink-soft">{o.carrier} tracking number</p>
            <p className="font-mono text-xl font-bold tracking-wider">{o.trackingNumber}</p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={o.trackingNumber} />
            <a href={INDIA_POST_TRACK_URL} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-royal px-4 text-sm font-bold text-white hover:bg-royal-deep">
              Track on India Post <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_300px]">
        <div>
          <h3 className="font-sans text-lg font-bold">Updates</h3>
          <ol className="mt-4 space-y-5 border-l-2 border-line pl-5">
            {o.events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-paper bg-royal" aria-hidden />
                <p className="font-normal">{e.message}</p>
                <p className="text-xs text-ink-mute">
                  {formatDate(e.createdAt, true)}
                  {e.location && `, ${e.location}`}
                </p>
              </li>
            ))}
          </ol>

          <h3 className="mt-10 font-sans text-lg font-bold">Items</h3>
          <ul className="mt-3 divide-y divide-line">
            {o.items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 py-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-sky">
                  {it.image ? <Media src={it.image} alt="" className="h-full w-full object-cover" /> : <ProductArt name={it.name} seed={it.productId ?? it.id} />}
                </div>
                <p className="flex-1">
                  {it.name} <span className="text-ink-mute">× {it.qty}</span>
                </p>
                <p className="font-bold tabular-nums">{inr(it.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-6">
          <div className="rounded-2xl border border-line p-5 text-sm">
            <h3 className="font-sans font-bold">Delivering to</h3>
            <p className="mt-2">{a.name}</p>
            <p className="text-ink-soft">
              {a.line1}
              {a.line2 && `, ${a.line2}`}
              {a.landmark && `, near ${a.landmark}`}
              <br />
              {a.city}, {a.state} {a.pincode}
            </p>
            <p className="mt-1 text-ink-soft">{a.phone}</p>
          </div>
          <dl className="space-y-2 rounded-2xl border border-line p-5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular-nums">{inr(o.subtotal)}</dd></div>
            {o.discountLines.map((d) => (
              <div key={d.id} className="flex justify-between text-mor"><dt>{d.label}</dt><dd className="tabular-nums">{d.amount ? `−${inr(d.amount)}` : "Applied"}</dd></div>
            ))}
            <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd className="tabular-nums">{o.shippingFee ? inr(o.shippingFee) : "Free"}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Paid</dt><dd className="tabular-nums">{inr(o.total)}</dd></div>
          </dl>
        </aside>
      </div>
    </Container>
  );
}
