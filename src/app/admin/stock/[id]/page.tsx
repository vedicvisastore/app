"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { Button, Spinner , PageLoader } from "@/components/ui";
import { Select } from "@/components/select";
import type { StockReason } from "@/db/schema";
import { useTRPC } from "@/lib/trpc/client";
import { cn, formatDate, inr } from "@/lib/utils";
import { Card, Field, MoneyInput, PageHeader, Stat, td, th, useToast } from "../../_ui";

const REASON: Record<StockReason, string> = {
  opening: "Opening balance",
  restock: "Restock",
  order: "Sold",
  cancel: "Order cancelled",
  adjustment: "Count corrected",
  damaged: "Damaged / lost",
  return: "Customer return",
};

type Form = { direction: "in" | "out"; qty: string; reason: "restock" | "return" | "damaged" | "adjustment"; note: string; unitCost: number | null };

export default function StockLedger({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const productId = Number(id);
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery(trpc.admin.stockLedger.queryOptions({ productId }));
  const [f, setF] = useState<Form>({ direction: "in", qty: "", reason: "restock", note: "", unitCost: null });
  const move = useMutation(
    trpc.admin.moveStock.mutationOptions({
      onSuccess: (m) => {
        qc.invalidateQueries({ queryKey: trpc.admin.stockLedger.queryKey({ productId }) });
        qc.invalidateQueries({ queryKey: trpc.admin.products.queryKey() });
        toast(`${m.delta > 0 ? "Added" : "Removed"} ${Math.abs(m.delta)}. Balance ${m.balanceAfter}.`);
        setF((s) => ({ ...s, qty: "", note: "" }));
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  if (isLoading || !data) return <PageLoader />;
  const { product: p, movements, totals } = data;
  const qty = Number(f.qty);

  return (
    <>
      <Link href={`/admin/products/${p.id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-royal">
        <ArrowLeft className="size-4" /> {p.name}
      </Link>
      <PageHeader title="Stock ledger" description={`${p.name} (${p.sku}). Every unit in and out, newest first. Sales are recorded when an order is paid.`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="In stock now" value={p.stock ?? "Not tracked"} tone={p.stock === 0 ? "gulal" : "royal"} />
        <Stat label="Total in" value={`+${totals.in}`} tone="mor" />
        <Stat label="Total out" value={`−${totals.out}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.8fr]">
        <Card className="h-fit p-5">
          <h2 className="font-sans text-lg font-bold">Record a movement</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!qty) return;
              move.mutate({ productId, qty, direction: f.direction, reason: f.reason, note: f.note || undefined, unitCost: f.direction === "in" ? f.unitCost : null });
            }}
          >
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Direction">
              {(["in", "out"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={f.direction === d}
                  onClick={() => setF({ ...f, direction: d, reason: d === "in" ? "restock" : "damaged" })}
                  className={cn("h-11 rounded-xl border-[1.5px] font-bold", f.direction === d ? (d === "in" ? "border-mor bg-mor-soft text-mor" : "border-gulal bg-gulal-soft text-gulal") : "border-line text-ink-soft")}
                >
                  {d === "in" ? "Add stock (+)" : "Remove stock (−)"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantity">
                <input required inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/\D/g, "") })} className="field tabular-nums" />
              </Field>
              <Field label="Reason">
                <Select
                  value={f.reason}
                  onChange={(v) => setF({ ...f, reason: v })}
                  options={
                    f.direction === "in"
                      ? [
                          { value: "restock", label: "Restock" },
                          { value: "return", label: "Customer return" },
                          { value: "adjustment", label: "Count corrected" },
                        ]
                      : [
                          { value: "damaged", label: "Damaged / lost" },
                          { value: "adjustment", label: "Count corrected" },
                        ]
                  }
                />
              </Field>
            </div>
            {f.direction === "in" && f.reason === "restock" && (
              <Field label="Cost per unit (optional)" hint={`Current cost ${inr(p.cost)}`}>
                <MoneyInput value={f.unitCost} allowEmpty onChange={(v) => setF({ ...f, unitCost: v })} />
              </Field>
            )}
            <Field label="Note (optional)">
              <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="field" placeholder={f.direction === "in" ? "Supplier, bill number" : "What happened"} maxLength={200} />
            </Field>
            <Button className="w-full" disabled={move.isPending || !qty}>
              {move.isPending && <Spinner />} {f.direction === "in" ? `Add ${qty || ""} to stock` : `Remove ${qty || ""} from stock`}
            </Button>
            {p.stock != null && qty > 0 && (
              <p className="text-center text-sm text-ink-soft">
                Balance after: <b className="text-ink tabular-nums">{Math.max(0, p.stock + (f.direction === "in" ? qty : -qty))}</b>
              </p>
            )}
          </form>
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-sky/40">
                <th className={th}>When</th><th className={th}>Movement</th><th className={th}>Details</th><th className={`${th} text-right`}>Change</th><th className={`${th} text-right`}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr><td colSpan={5} className={`${td} py-10 text-center text-ink-mute`}>No movements yet. Add stock to start the ledger.</td></tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDate(m.createdAt, true)}</td>
                  <td className={`${td} font-bold`}>{REASON[m.reason]}</td>
                  <td className={`${td} text-ink-soft`}>
                    {m.orderNumber ? <Link href={`/admin/orders/${m.orderId}`} className="font-bold text-royal">{m.orderNumber}</Link> : m.note}
                    {m.orderNumber && m.note && !m.note.startsWith("Order") ? `, ${m.note}` : ""}
                    {m.unitCost != null && <span className="block text-xs">{inr(m.unitCost)} a unit</span>}
                    {m.by && <span className="block text-xs text-ink-mute">by {m.by}</span>}
                  </td>
                  <td className={cn(td, "text-right font-bold tabular-nums", m.delta > 0 ? "text-mor" : "text-gulal")}>{m.delta > 0 ? `+${m.delta}` : `−${-m.delta}`}</td>
                  <td className={`${td} text-right tabular-nums`}>{m.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
