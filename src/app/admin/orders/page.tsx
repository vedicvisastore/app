"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/app/(store)/account/status-pill";
import { Select } from "@/components/select";
import { PageLoader, Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { adminLabel, cn, customerHref, formatDate, INDIAN_STATES, inr, ORDER_STATUS_LABEL } from "@/lib/utils";
import { Card, Field, MoneyInput, PAGE_SIZES, PageHeader, Pagination, Tabs, td, th } from "../_ui";

const STATUS_TABS = ["all", "paid", "packed", "shipped", "delivered", "cancelled", "pending_payment"] as const;
type S = (typeof STATUS_TABS)[number];

const IST = 5.5 * 3600_000;
const DAY = 86_400_000;
/** Midnight India time, `days` from today, as a UTC instant. */
const istDay = (days = 0) => {
  const n = new Date(Date.now() + IST);
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - IST + days * DAY);
};
const istMonth = (offset = 0) => {
  const n = new Date(Date.now() + IST);
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + offset, 1) - IST);
};
/** "2026-11-24" typed in a date box → midnight India time that day. */
const istDate = (s: string, plusDays = 0) => (s ? new Date(Date.parse(`${s}T00:00:00Z`) - IST + plusDays * DAY) : null);

const DATES = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Pick dates" },
];
function dateRange(key: string, from: string, to: string): { from?: Date; to?: Date } {
  switch (key) {
    case "today":
      return { from: istDay(0), to: istDay(1) };
    case "yesterday":
      return { from: istDay(-1), to: istDay(0) };
    case "7d":
      return { from: istDay(-6), to: istDay(1) };
    case "30d":
      return { from: istDay(-29), to: istDay(1) };
    case "month":
      return { from: istMonth(0), to: istMonth(1) };
    case "last-month":
      return { from: istMonth(-1), to: istMonth(0) };
    case "year": {
      const y = new Date(Date.now() + IST).getUTCFullYear();
      return { from: new Date(Date.UTC(y, 0, 1) - IST), to: new Date(Date.UTC(y + 1, 0, 1) - IST) };
    }
    case "custom":
      return { from: istDate(from) ?? undefined, to: istDate(to, 1) ?? undefined };
    default:
      return {};
  }
}

const OFFERS = [
  { value: "", label: "Any" },
  { value: "coupon", label: "Coupon code used" },
  { value: "discount", label: "Any discount" },
  { value: "none", label: "No discount" },
];
const SORTS = [
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
  { value: "high", label: "Highest total" },
  { value: "low", label: "Lowest total" },
];
const STATE_OPTIONS = [{ value: "", label: "All states" }, ...INDIAN_STATES.map((s) => ({ value: s, label: s }))];
const FILTER_KEYS = ["date", "from", "to", "state", "product", "offer", "min", "max"] as const;
/** Every control on this page is one height (40px) with the form-field edge, so the bar and the filters line up. */
const CTRL = "!min-h-10 h-10 !py-1 text-base sm:text-sm";

function Orders() {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const status = (STATUS_TABS.find((s) => s === params.get("status")) ?? "all") as S;
  const sort = (SORTS.find((s) => s.value === get("sort"))?.value ?? "new") as "new" | "old" | "high" | "low";

  /** Every filter lives in the address, so Back, refresh and shared links keep it. */
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!("page" in patch)) next.delete("page"); // any other change starts again at page 1
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Search typing updates the address after a short pause.
  const [q, setQ] = useState(get("q"));
  useEffect(() => {
    const t = setTimeout(() => q.trim() !== get("q") && setParams({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = FILTER_KEYS.filter((k) => get(k) && !(k === "from" || k === "to")).length;
  const [open, setOpen] = useState(active > 0);
  const page = Math.max(1, Number(get("page")) || 1);
  const pageSize = PAGE_SIZES.find((n) => n === Number(get("per"))) ?? 50;
  const range = dateRange(get("date"), get("from"), get("to"));
  const input = {
    status: status === "all" ? undefined : status,
    q: get("q") || undefined,
    from: range.from?.toISOString(),
    to: range.to?.toISOString(),
    state: get("state") || undefined,
    productId: Number(get("product")) || undefined,
    offer: (get("offer") || undefined) as "coupon" | "discount" | "none" | undefined,
    minTotal: get("min") ? Number(get("min")) : undefined,
    maxTotal: get("max") ? Number(get("max")) : undefined,
    sort,
    page,
    pageSize,
  };
  const { data, isLoading, isFetching } = useQuery({ ...trpc.admin.orders.queryOptions(input), placeholderData: keepPreviousData });
  const dash = useQuery(trpc.admin.dashboard.queryOptions());
  const counts = dash.data?.byStatus ?? {};
  const products = useQuery({ ...trpc.admin.products.queryOptions({}), enabled: open || !!get("product") });
  const productOptions = useMemo(
    () => [{ value: "", label: "Any product" }, ...(products.data ?? []).filter((p) => p.visibility !== "internal").map((p) => ({ value: String(p.id), label: adminLabel(p) }))],
    [products.data],
  );

  // What's applied, as removable chips.
  const chips: { key: string; label: string; clear: Record<string, null> }[] = [];
  if (get("date")) chips.push({ key: "date", label: get("date") === "custom" ? `${get("from") || "…"} to ${get("to") || "…"}` : DATES.find((d) => d.value === get("date"))?.label ?? "", clear: { date: null, from: null, to: null } });
  if (get("state")) chips.push({ key: "state", label: get("state"), clear: { state: null } });
  if (get("product")) chips.push({ key: "product", label: productOptions.find((p) => p.value === get("product"))?.label ?? "Product", clear: { product: null } });
  if (get("offer")) chips.push({ key: "offer", label: OFFERS.find((o) => o.value === get("offer"))?.label ?? "", clear: { offer: null } });
  if (get("min") || get("max")) chips.push({ key: "total", label: get("min") && get("max") ? `${inr(Number(get("min")))} to ${inr(Number(get("max")))}` : get("min") ? `From ${inr(Number(get("min")))}` : `Up to ${inr(Number(get("max")))}`, clear: { min: null, max: null } });
  const clearAll = () => setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));

  const list = data?.orders ?? [];
  return (
    <>
      <PageHeader title="Orders" description="Pack paid orders, then add the India Post tracking number when you hand them over. Customers see every update on their order page." />
      <Card>
        <div className="px-4 pt-2">
          <Tabs<S>
            value={status}
            onChange={(v) => setParams({ status: v === "all" ? null : v })}
            items={STATUS_TABS.map((s) => ({ value: s, label: s === "all" ? "All" : s === "paid" ? "To pack" : s === "packed" ? "To ship" : s === "pending_payment" ? "Unpaid" : ORDER_STATUS_LABEL[s], count: s === "all" ? undefined : counts[s] }))}
          />
        </div>

        {/* Search, filters button and sort */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="relative min-w-0 flex-[1_1_16rem]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order number, name, phone, email or tracking" className={cn("field pl-9", CTRL)} aria-label="Search orders" />
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn("flex h-10 items-center gap-2 rounded-[10px] border-[1.5px] px-3.5 text-sm font-medium transition-colors", open || active ? "border-ink bg-ink text-white" : "border-[var(--color-field-edge)] bg-paper text-ink hover:border-ink-soft")}
          >
            <SlidersHorizontal className="size-4" aria-hidden /> Filters
            {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-white text-xs font-semibold text-ink">{active}</span>}
          </button>
          <Select className={cn("w-auto", CTRL)} aria-label="Sort orders" value={sort} onChange={(v) => setParams({ sort: v === "new" ? null : v })} menuMinWidth={170} options={SORTS} />
        </div>

        {open && (
          <div className="grid gap-4 border-t border-line bg-paper-2/60 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Placed">
              <Select value={get("date")} onChange={(v) => setParams({ date: v || null, ...(v !== "custom" && { from: null, to: null }) })} options={DATES} className={CTRL} />
            </Field>
            <Field label="State">
              <Select value={get("state")} onChange={(v) => setParams({ state: v || null })} options={STATE_OPTIONS} className={CTRL} />
            </Field>
            <Field label="Has this product">
              <Select value={get("product")} onChange={(v) => setParams({ product: v || null })} options={productOptions} searchable menuMinWidth={260} className={CTRL} />
            </Field>
            <Field label="Offer">
              <Select value={get("offer")} onChange={(v) => setParams({ offer: v || null })} options={OFFERS} className={CTRL} />
            </Field>
            {get("date") === "custom" && (
              <>
                <Field label="From">
                  <input type="date" className={cn("field", CTRL)} value={get("from")} max={get("to") || undefined} onChange={(e) => setParams({ from: e.target.value || null })} />
                </Field>
                <Field label="To">
                  <input type="date" className={cn("field", CTRL)} value={get("to")} min={get("from") || undefined} onChange={(e) => setParams({ to: e.target.value || null })} />
                </Field>
              </>
            )}
            <Field label="Total from">
              <MoneyInput value={get("min") ? Number(get("min")) : null} allowEmpty placeholder="Any" className={CTRL} onChange={(v) => setParams({ min: v != null ? String(v) : null })} />
            </Field>
            <Field label="Total up to">
              <MoneyInput value={get("max") ? Number(get("max")) : null} allowEmpty placeholder="Any" className={CTRL} onChange={(v) => setParams({ max: v != null ? String(v) : null })} />
            </Field>
          </div>
        )}

        {/* Result line + applied filters */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 text-sm">
          <span className="text-ink-soft">
            {data ? (
              <>
                <b className="font-semibold text-ink">{data.count}</b> {data.count === 1 ? "order" : "orders"} · <b className="font-semibold text-ink">{inr(data.total)}</b>
              </>
            ) : (
              "Loading…"
            )}
          </span>
          {isFetching && !isLoading && <Spinner className="size-4" />}
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => setParams(c.clear)} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper py-0.5 pr-1.5 pl-2.5 text-xs text-ink hover:border-ink-soft" aria-label={`Remove filter ${c.label}`}>
              {c.label} <X className="size-3.5 text-ink-soft" aria-hidden />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={clearAll} className="text-xs font-medium text-royal hover:underline">
              Clear all
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-line bg-sky/40"><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Items</th><th className={th}>Status</th><th className={th}>Tracking</th><th className={`${th} text-right`}>Total</th></tr></thead>
            <tbody>
              {isLoading && <tr><td className={td} colSpan={6}><PageLoader /></td></tr>}
              {data && list.length === 0 && <tr><td className={`${td} py-10 text-center text-ink-mute`} colSpan={6}>No orders match.{chips.length > 0 && <> <button type="button" onClick={clearAll} className="font-medium text-royal hover:underline">Clear filters</button></>}</td></tr>}
              {list.map((o) => (
                <tr key={o.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-sky/40" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                  <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-bold text-royal" onClick={(e) => e.stopPropagation()}>{o.number}</Link><p className="text-xs text-ink-mute">{formatDate(o.createdAt, true)}</p></td>
                  <td className={td}><Link href={customerHref(o.email)} className="font-bold hover:text-royal" onClick={(e) => e.stopPropagation()}>{o.shippingAddress.name}</Link><p className="text-xs text-ink-mute">{o.shippingAddress.phone}, {o.shippingAddress.city ?? o.shippingAddress.pincode}</p></td>
                  <td className={`${td} max-w-[260px]`}><p className="truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p></td>
                  <td className={td}><StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status]} /></td>
                  <td className={`${td} font-mono text-xs`}>{o.trackingNumber ?? <span className="text-ink-mute">—</span>}</td>
                  <td className={`${td} text-right font-bold tabular-nums`}>{inr(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={data.count}
            noun="orders"
            onPage={(p) => {
              setParams({ page: p > 1 ? String(p) : null });
              document.querySelector("main")?.scrollIntoView({ block: "start" });
            }}
            onPageSize={(n) => setParams({ per: n === 50 ? null : String(n) })}
          />
        )}
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
