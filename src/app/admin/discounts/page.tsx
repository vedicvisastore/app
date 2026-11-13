"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import type { Discount, DiscountKind, DiscountType } from "@/db/schema";
import { discountState } from "@/lib/discount-status";
import { useTRPC } from "@/lib/trpc/client";
import { cn, formatDate, inr } from "@/lib/utils";
import { Card, ConfirmButton, Field, MoneyInput, PageHeader, Toggle, useToast } from "../_ui";

const KIND: Record<DiscountKind, { label: string; help: string }> = {
  sale: { label: "Sale", help: "Lowers product prices in the shop automatically. Shown with a sale badge." },
  coupon: { label: "Coupon code", help: "Customer types a code at checkout." },
  auto_cart: { label: "Automatic cart offer", help: "Applied at checkout when the cart qualifies, e.g. ₹150 off above ₹1,999. The best one wins." },
};

type Draft = {
  id?: number;
  kind: DiscountKind;
  name: string;
  code: string;
  type: DiscountType;
  value: number;
  productIds: number[];
  categoryIds: number[];
  minSubtotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const empty = (kind: DiscountKind): Draft => ({ kind, name: "", code: "", type: "percent", value: 10, productIds: [], categoryIds: [], minSubtotal: 0, maxDiscount: null, usageLimit: null, perUserLimit: null, startsAt: "", endsAt: "", active: true });
const toLocal = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function describe(d: Discount) {
  const amt = d.type === "percent" ? `${d.value}% off` : d.type === "flat" ? `${inr(d.value)} off` : "Free shipping";
  const parts = [amt];
  if (d.minSubtotal) parts.push(`above ${inr(d.minSubtotal)}`);
  if (d.maxDiscount) parts.push(`up to ${inr(d.maxDiscount)}`);
  if (d.productIds.length || d.categoryIds.length) parts.push("on selected items");
  return parts.join(", ");
}

const STATE_BADGE = {
  off: { label: "Off", cls: "bg-line text-ink-soft" },
  scheduled: { label: "Scheduled", cls: "bg-haldi-soft text-gold-ink" },
  live: { label: "Live", cls: "bg-mor-soft text-mor" },
  ended: { label: "Ended", cls: "bg-line text-ink-soft" },
  used_up: { label: "Used up", cls: "bg-line text-ink-soft" },
} as const;

function status(d: Discount) {
  const st = discountState(d);
  return st === "scheduled" && d.startsAt ? { ...STATE_BADGE.scheduled, label: `Starts ${formatDate(d.startsAt)}` } : STATE_BADGE[st];
}

export default function DiscountsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery(trpc.admin.discounts.queryOptions());
  const products = useQuery(trpc.admin.products.queryOptions({ visibility: "public" }));
  const cats = useQuery(trpc.admin.categories.queryOptions());
  const [d, setD] = useState<Draft | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.admin.discounts.queryKey() });
  const save = useMutation(trpc.admin.saveDiscount.mutationOptions({ onSuccess: () => { invalidate(); toast("Offer saved"); setD(null); }, onError: (e) => toast(e.message, "error") }));
  const toggle = useMutation(trpc.admin.toggleDiscount.mutationOptions({ onSuccess: invalidate }));
  const del = useMutation(trpc.admin.deleteDiscount.mutationOptions({ onSuccess: () => { invalidate(); toast("Offer deleted"); } }));

  const edit = (x: Discount) =>
    setD({ id: x.id, kind: x.kind, name: x.name, code: x.code ?? "", type: x.type, value: x.value, productIds: x.productIds, categoryIds: x.categoryIds, minSubtotal: x.minSubtotal, maxDiscount: x.maxDiscount, usageLimit: x.usageLimit, perUserLimit: x.perUserLimit, startsAt: toLocal(x.startsAt), endsAt: toLocal(x.endsAt), active: x.active });

  return (
    <>
      <PageHeader
        title="Sales & coupons"
        description="Everything here applies at checkout automatically. A coupon stacks with the best automatic cart offer."
        actions={(["sale", "coupon", "auto_cart"] as const).map((k) => (
          <Button key={k} size="sm" variant={k === "coupon" ? "primary" : "outline"} onClick={() => setD(empty(k))}><Plus className="size-4" /> {KIND[k].label}</Button>
        ))}
      />

      {isLoading && <Spinner className="text-ink-mute" />}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {(["sale", "coupon", "auto_cart"] as const).map((k) => {
            const rows = (data ?? []).filter((x) => x.kind === k);
            return (
              <Card key={k} className="p-5">
                <h2 className="font-sans text-lg font-bold">{KIND[k].label}s</h2>
                <p className="text-sm text-ink-soft">{KIND[k].help}</p>
                {rows.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-mute">None yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {rows.map((x) => {
                      const s = status(x);
                      return (
                        <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold">{x.code ? <span className="mr-2 rounded-md bg-sky px-2 py-0.5 font-mono text-sm">{x.code}</span> : null}{x.name}</p>
                            <p className="text-sm text-ink-soft">{describe(x)}{x.usageLimit ? `, ${x.usedCount}/${x.usageLimit} used` : x.usedCount ? `, used ${x.usedCount}×` : ""}{x.endsAt ? `, ends ${formatDate(x.endsAt)}` : ""}</p>
                          </div>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", s.cls)}>{s.label}</span>
                          <Toggle checked={x.active} onChange={(v) => toggle.mutate({ id: x.id, active: v })} />
                          <button className="text-sm font-bold text-royal" onClick={() => edit(x)}>Edit</button>
                          <ConfirmButton onConfirm={() => del.mutate({ id: x.id })} confirmLabel="Delete" className="text-sm font-bold text-ink-mute hover:text-gulal">Delete</ConfirmButton>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>

        {d && (
          <Card className="h-fit space-y-4 p-5 xl:sticky xl:top-6">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-lg font-bold">{d.id ? "Edit" : "New"} {KIND[d.kind].label.toLowerCase()}</h2>
              <button onClick={() => setD(null)} className="text-ink-mute hover:text-ink" aria-label="Close"><X className="size-5" /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({
                  ...d,
                  code: d.code || null,
                  startsAt: d.startsAt ? new Date(d.startsAt) : null,
                  endsAt: d.endsAt ? new Date(d.endsAt) : null,
                });
              }}
            >
              <Field label="Name" hint="Shown to shoppers on sale badges and at checkout">
                <input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className="field" placeholder={d.kind === "sale" ? "Janmashtami sale" : d.kind === "coupon" ? "Welcome offer" : "₹150 off above ₹1,999"} />
              </Field>
              {d.kind === "coupon" && (
                <Field label="Code"><input required value={d.code} onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase().replace(/\s/g, "") })} className="field font-mono uppercase" placeholder="RADHE10" /></Field>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type">
                  <select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as DiscountType, value: e.target.value === "percent" ? 10 : e.target.value === "flat" ? 10000 : 0 })} className="field">
                    <option value="percent">Percent off</option>
                    <option value="flat">Flat ₹ off</option>
                    {d.kind !== "sale" && <option value="free_shipping">Free shipping</option>}
                  </select>
                </Field>
                {d.type === "percent" && <Field label="Percent"><input type="number" min={1} max={90} value={d.value} onChange={(e) => setD({ ...d, value: Number(e.target.value) || 0 })} className="field" /></Field>}
                {d.type === "flat" && <Field label="Amount"><MoneyInput value={d.value} onChange={(v) => setD({ ...d, value: v ?? 0 })} /></Field>}
              </div>
              {d.kind !== "sale" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Minimum cart" hint="0 = any cart"><MoneyInput value={d.minSubtotal} onChange={(v) => setD({ ...d, minSubtotal: v ?? 0 })} /></Field>
                  {d.type === "percent" && <Field label="Max discount" hint="Optional cap"><MoneyInput value={d.maxDiscount} allowEmpty onChange={(v) => setD({ ...d, maxDiscount: v })} /></Field>}
                </div>
              )}
              {d.kind === "coupon" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Total uses" hint="Empty = unlimited"><input type="number" min={1} value={d.usageLimit ?? ""} onChange={(e) => setD({ ...d, usageLimit: e.target.value ? Number(e.target.value) : null })} className="field" /></Field>
                  <Field label="Uses per customer"><input type="number" min={1} value={d.perUserLimit ?? ""} onChange={(e) => setD({ ...d, perUserLimit: e.target.value ? Number(e.target.value) : null })} className="field" /></Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Starts" hint="Empty = now"><input type="datetime-local" value={d.startsAt} onChange={(e) => setD({ ...d, startsAt: e.target.value })} className="field" /></Field>
                <Field label="Ends" hint="Empty = never"><input type="datetime-local" value={d.endsAt} onChange={(e) => setD({ ...d, endsAt: e.target.value })} className="field" /></Field>
              </div>
              <div>
                <span className="label">Applies to</span>
                <p className="mb-2 text-xs text-ink-mute">Pick nothing to apply to everything.</p>
                <div className="flex flex-wrap gap-1.5">
                  {cats.data?.map((c) => {
                    const on = d.categoryIds.includes(c.id);
                    return <button key={c.id} type="button" onClick={() => setD({ ...d, categoryIds: on ? d.categoryIds.filter((x) => x !== c.id) : [...d.categoryIds, c.id] })} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-normal", on ? "border-royal bg-royal text-white" : "border-line text-ink-soft")}>{c.name}</button>;
                  })}
                </div>
                <select
                  className="field mt-2"
                  value=""
                  onChange={(e) => e.target.value && setD({ ...d, productIds: [...new Set([...d.productIds, Number(e.target.value)])] })}
                >
                  <option value="">Add a specific product…</option>
                  {products.data?.filter((p) => !d.productIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {d.productIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.productIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-0.5 text-xs">
                        {products.data?.find((p) => p.id === id)?.name ?? `#${id}`}
                        <button type="button" onClick={() => setD({ ...d, productIds: d.productIds.filter((x) => x !== id) })} aria-label="Remove"><X className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Toggle checked={d.active} onChange={(v) => setD({ ...d, active: v })} label="Active" />
              <Button className="w-full" disabled={save.isPending}>{save.isPending && <Spinner />} Save offer</Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
