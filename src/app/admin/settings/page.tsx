"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import type { StoreSettings } from "@/lib/settings-defaults";
import { useTRPC } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";
import { Card, Field, MoneyInput, PageHeader, useToast } from "../_ui";

export default function SettingsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery(trpc.admin.settings.queryOptions());
  const hooks = useQuery(trpc.admin.webhookLog.queryOptions());
  const [s, setS] = useState<StoreSettings | null>(null);
  useEffect(() => {
    if (data && !s) {
      const { integrations: _i, ...rest } = data;
      setS(rest);
    }
  }, [data, s]);
  const save = useMutation(trpc.admin.saveSettings.mutationOptions({ onSuccess: () => { qc.invalidateQueries({ queryKey: trpc.admin.settings.queryKey() }); toast("Settings saved"); }, onError: (e) => toast(e.message, "error") }));

  if (!data || !s) return <Spinner className="text-ink-mute" />;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const integ = [
    { ok: data.integrations.razorpay, label: "Razorpay payments", fix: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET" },
    { ok: data.integrations.razorpayWebhook, label: "Razorpay webhook", fix: `Add ${origin}/api/webhooks/razorpay in Razorpay (events: payment.captured, order.paid) and set RAZORPAY_WEBHOOK_SECRET` },
    { ok: data.integrations.email, label: "Emails (Resend)", fix: "Set RESEND_API_KEY and verify your domain in Resend" },
    { ok: data.integrations.r2, label: "Media storage (Cloudflare R2)", fix: "Set the R2_* variables; until then uploads are saved locally" },
    { ok: data.integrations.shippingWebhook, label: "Shipping webhook (optional)", fix: "Set SHIPPING_WEBHOOK_SECRET to accept courier updates" },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(s);
          }}
        >
          <Card className="space-y-4 p-5">
            <h2 className="font-sans text-lg font-bold">Shipping</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Shipping fee"><MoneyInput value={s.shippingFee} onChange={(v) => setS({ ...s, shippingFee: v ?? 0 })} /></Field>
              <Field label="Free shipping from" hint="Cart total after discounts. 0 = always free."><MoneyInput value={s.freeShippingThreshold} onChange={(v) => setS({ ...s, freeShippingThreshold: v ?? 0 })} /></Field>
              <Field label="Delivery estimate, from (days)"><input type="number" min={1} value={s.deliveryDaysMin} onChange={(e) => setS({ ...s, deliveryDaysMin: Number(e.target.value) || 1 })} className="field" /></Field>
              <Field label="to (days)"><input type="number" min={1} value={s.deliveryDaysMax} onChange={(e) => setS({ ...s, deliveryDaysMax: Number(e.target.value) || 1 })} className="field" /></Field>
            </div>
          </Card>
          <Card className="space-y-4 p-5">
            <h2 className="font-sans text-lg font-bold">Store</h2>
            <p className="rounded-xl bg-sky/50 px-4 py-3 text-sm text-ink-soft">
              The scrolling strip at the top of the store is edited in <Link href="/admin/ribbon" className="font-bold text-royal">Top ribbon</Link>.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Support email"><input value={s.supportEmail} onChange={(e) => setS({ ...s, supportEmail: e.target.value })} className="field" /></Field>
              <Field label="Support phone"><input value={s.supportPhone} onChange={(e) => setS({ ...s, supportPhone: e.target.value })} className="field" /></Field>
              <Field label="Store Instagram"><input value={s.instagram} onChange={(e) => setS({ ...s, instagram: e.target.value })} className="field" placeholder="@vedicvisastore or profile link" /></Field>
            </div>
            <Field label="Creator’s Instagram" hint="Shown as “Meet the creator”. Leave empty to hide."><input value={s.creatorInstagram} onChange={(e) => setS({ ...s, creatorInstagram: e.target.value })} className="field" placeholder="@vedicvisa or profile link" /></Field>
            <Field label="YouTube" hint="Channel link or @handle"><input value={s.youtube} onChange={(e) => setS({ ...s, youtube: e.target.value })} className="field" placeholder="https://www.youtube.com/@vedicvisa" /></Field>
          </Card>
          <Button disabled={save.isPending}>{save.isPending && <Spinner />} Save settings</Button>
        </form>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Connections</h2>
            <ul className="mt-3 space-y-3">
              {integ.map((i) => (
                <li key={i.label} className="flex gap-3 text-sm">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${i.ok ? "bg-mor text-white" : "bg-line text-ink-mute"}`}>{i.ok ? <Check className="size-3" /> : <X className="size-3" />}</span>
                  <div>
                    <p className="font-bold">{i.label}</p>
                    {!i.ok && <p className="text-ink-soft">{i.fix}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-sans text-lg font-bold">Courier webhook</h2>
            <p className="mt-1 text-sm text-ink-soft">For later, if you add Shiprocket or another courier. Point its webhook to:</p>
            <code className="mt-2 block rounded-lg bg-sky px-3 py-2 text-xs break-all">{origin}/api/webhooks/shipping/shiprocket</code>
            <p className="mt-2 text-xs text-ink-mute">Send the secret in an <code>x-webhook-secret</code> header. Updates match orders by order number or AWB and appear on the customer's timeline.</p>
            <h3 className="mt-4 text-sm font-bold">Recent webhook calls</h3>
            {hooks.data?.length ? (
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs">
                {hooks.data.map((h) => (
                  <li key={h.id} className="flex justify-between gap-2 border-b border-line py-1">
                    <span>{h.provider}: {h.eventType || "event"}</span>
                    <span className={h.error ? "text-gulal" : "text-ink-mute"}>{h.error ?? formatDate(h.receivedAt, true)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-ink-mute">None received yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
