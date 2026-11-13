"use client";
import { useMutation } from "@tanstack/react-query";
import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useContent } from "@/components/site/content-context";
import { Button, Spinner } from "@/components/ui";
import { STATUS_MESSAGE } from "@/lib/order-machine";
import { useTRPC } from "@/lib/trpc/client";
import { cn, formatDate, INDIA_POST_TRACK_URL, ORDER_STATUS_LABEL } from "@/lib/utils";
import { StatusPill } from "../account/status-pill";

const STEPS = ["paid", "packed", "shipped", "delivered"] as const;

export function TrackForm({ defaultEmail, defaultNumber }: { defaultEmail: string; defaultNumber: string }) {
  const trpc = useTRPC();
  const c = useContent().pages;
  const [number, setNumber] = useState(defaultNumber);
  const [email, setEmail] = useState(defaultEmail);
  const track = useMutation(trpc.track.order.mutationOptions());
  const o = track.data;
  const reached = o ? STEPS.indexOf(o.status as (typeof STEPS)[number]) : -1;
  const stopped = o && (o.status === "cancelled" || o.status === "refunded" || o.status === "pending_payment");

  return (
    <>
      <form
        className="mt-8 grid gap-3 sm:grid-cols-[1fr_1.3fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          track.mutate({ number, email });
        }}
      >
        <label>
          <span className="label">Order number</span>
          <input required value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="VV-AB12CD" className="field uppercase" autoComplete="off" />
        </label>
        <label>
          <span className="label">Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field" autoComplete="email" />
        </label>
        <Button className="self-end" disabled={track.isPending}>
          {track.isPending ? <Spinner /> : c.trackCta}
        </Button>
      </form>
      {track.error && <p className="mt-4 rounded-xl bg-gulal-soft px-4 py-3 text-sm text-gulal">{track.error.message}</p>}

      {o && (
        <section className="mt-10 rounded-3xl border border-line p-5 sm:p-7" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">Order {o.number} · placed {formatDate(o.placedAt)}</p>
              <p className="mt-1 text-lg font-bold">{STATUS_MESSAGE[o.status]}</p>
            </div>
            <StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status] ?? o.status} />
          </div>

          {!stopped && (
            <ol className="mt-7 grid grid-cols-4 gap-1">
              {STEPS.map((s, i) => (
                <li key={s} className="flex flex-col items-center gap-2 text-center">
                  <span className={cn("h-1.5 w-full rounded-full", i <= reached ? "bg-mor" : "bg-line")} />
                  <span className={cn("grid size-7 place-items-center rounded-full text-xs", i <= reached ? "bg-mor text-white" : "bg-line text-ink-mute")}>
                    {i <= reached ? <Check className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("text-xs sm:text-sm", i <= reached ? "font-bold text-ink" : "text-ink-mute")}>{ORDER_STATUS_LABEL[s]}</span>
                </li>
              ))}
            </ol>
          )}

          {o.trackingNumber && (
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper-2 p-4">
              <div>
                <p className="text-sm text-ink-soft">{o.carrier} tracking number</p>
                <p className="font-mono text-lg font-bold select-all">{o.trackingNumber}</p>
              </div>
              <a href={INDIA_POST_TRACK_URL} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-royal px-4 text-sm font-bold text-white">
                {c.trackIndiaPost} <ExternalLink className="size-4" aria-hidden />
              </a>
            </div>
          )}

          <ul className="mt-6 divide-y divide-line border-t border-line text-sm">
            {o.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-4 py-2.5">
                <span>{it.name}</span>
                <span className="text-ink-soft">× {it.qty}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
