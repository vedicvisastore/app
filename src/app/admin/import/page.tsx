"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, FileSpreadsheet, FileUp, LineChart } from "lucide-react";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { columnsFor, type RawRow, type SheetName } from "@/lib/catalogue-sheet";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Card, PageHeader, Tabs, useToast } from "../_ui";

type Tab = "guide" | "upload" | "download";

/**
 * Admin → Excel. Three steps: what the file looks like, upload changes (checked before saving), download the
 * catalogue or the stock and sales report. Workbooks are built and read in the browser; the server only checks
 * and saves rows.
 */
export default function ExcelPage() {
  const [tab, setTab] = useState<Tab>("guide");
  return (
    <div className="max-w-5xl">
      <PageHeader title="Excel" description="Update the whole catalogue from one Excel file, and download the catalogue or a stock and sales report whenever you need." />
      <div className="mb-6">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "guide", label: "1. The file" },
            { value: "upload", label: "2. Upload changes" },
            { value: "download", label: "3. Download" },
          ]}
        />
      </div>
      {tab === "guide" && <Guide onNext={() => setTab("upload")} />}
      {tab === "upload" && <Upload />}
      {tab === "download" && <Downloads />}
    </div>
  );
}

// ── 1. What the file looks like ─────────────────────────────
function Guide({ onNext }: { onNext: () => void }) {
  const dl = useCatalogueDownload();
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-sans text-lg font-bold">
          <BookOpen className="size-5 text-royal" aria-hidden /> How it works
        </h2>
        <ol className="space-y-2 text-sm">
          {[
            ["The SKU decides the product.", "A SKU that's already in the store updates that product. A new SKU creates a new product."],
            ["Empty means no change.", "Only the cells you fill in change anything. Leave a cell empty to keep what's there."],
            ["Nothing is ever deleted.", "To take something off the store, set its Visibility to Hidden."],
            ["A dash (-) clears a value.", "For optional things like MRP, tagline or launch date. In Stock, a dash stops counting stock."],
            ["Two sheets.", "Single items on the Products sheet, boxes and sets on the Boxes sheet."],
            ["You see every change first.", "After uploading, the store lists exactly what will change and any problems. Nothing is saved until you press Save changes."],
          ].map(([b, t], i) => (
            <li key={b} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky text-xs font-bold text-royal">{i + 1}</span>
              <span>
                <b>{b}</b> <span className="text-ink-soft">{t}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => dl.run(false)} disabled={dl.busy}>
            {dl.busy ? <Spinner /> : <Download className="size-4" aria-hidden />} Download the current catalogue
          </Button>
          <Button size="sm" variant="outline" onClick={() => dl.run(true)} disabled={dl.busy}>
            Download an empty template
          </Button>
          <Button size="sm" variant="ghost" onClick={onNext}>
            Next: upload →
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-mute">Easiest: download the current catalogue, change it in Excel or Google Sheets, then upload it.</p>
      </Card>

      {(["Products", "Boxes"] as SheetName[]).map((sheet) => (
        <Card key={sheet} className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 font-sans text-lg font-bold">
            {sheet} sheet <span className="text-sm font-normal text-ink-mute">({sheet === "Products" ? "single items" : "boxes and sets"})</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky/40 text-left text-xs text-ink-soft">
                  <th className="px-4 py-2">Column</th>
                  <th className="px-4 py-2">Needed</th>
                  <th className="px-4 py-2">What it means</th>
                  <th className="px-4 py-2">Example</th>
                </tr>
              </thead>
              <tbody>
                {columnsFor(sheet).map((c) => (
                  <tr key={c.key} className="border-t border-line align-top">
                    <td className="px-4 py-2.5 font-bold whitespace-nowrap">{c.header}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {c.required === "always" ? (
                        <span className="rounded-full bg-gulal-soft px-2 py-0.5 text-xs font-bold text-gulal">Always</span>
                      ) : c.required === "new" ? (
                        <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-ink">New products</span>
                      ) : c.readOnly?.includes(sheet) ? (
                        <span className="text-xs text-ink-mute">Shown only</span>
                      ) : (
                        <span className="text-xs text-ink-mute">Optional{c.clearable ? " · dash clears" : ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{c.readOnly?.includes(sheet) ? `${c.help}` : c.help}</td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-pre-line text-ink-soft">{c.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function useCatalogueDownload() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (empty: boolean) => {
    setBusy(true);
    try {
      const data = await qc.fetchQuery({ ...trpc.admin.exportCatalogue.queryOptions(), staleTime: 0 });
      const { buildCatalogueWorkbook, downloadBlob } = await import("@/lib/excel-catalogue");
      const blob = await buildCatalogueWorkbook(empty ? { categories: data.categories, products: [] } : data);
      downloadBlob(blob, empty ? "vedicvisa-catalogue-template.xlsx" : `vedicvisa-catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

// ── 2. Upload: check, then save ─────────────────────────────
function Upload() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState("");
  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [show, setShow] = useState<"changes" | "all" | "problems">("changes");
  const check = useMutation(trpc.admin.importCatalogue.mutationOptions({ onError: (e) => toast(e.message, "error") }));
  const save = useMutation(
    trpc.admin.importCatalogue.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.admin.products.queryKey() });
        toast("Saved. The store is updated.");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  async function read(f: File) {
    setFile(f.name);
    setRows(null);
    check.reset();
    save.reset();
    setReading(true);
    try {
      const { parseCatalogueWorkbook } = await import("@/lib/excel-catalogue");
      const parsed = await parseCatalogueWorkbook(await f.arrayBuffer());
      setRows(parsed.rows);
      setWarnings(parsed.warnings);
      if (parsed.rows.length) check.mutate({ apply: false, rows: parsed.rows });
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setReading(false);
  }

  const plan = save.data ?? check.data;
  const list = plan?.rows.filter((r) => (show === "all" ? true : show === "problems" ? r.action === "error" : r.action === "create" || r.action === "update" || r.action === "error")) ?? [];

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong p-8 text-center hover:border-royal">
          {reading || check.isPending ? <Spinner className="size-8 text-gulal" /> : <FileUp className="size-8 text-mor" aria-hidden />}
          <span className="font-bold">{file || "Choose the catalogue .xlsx file"}</span>
          <span className="text-xs text-ink-mute">The store checks it first. Nothing is saved until you press Save changes.</span>
          <input type="file" accept=".xlsx" hidden onChange={(e) => { if (e.target.files?.[0]) void read(e.target.files[0]); e.target.value = ""; }} />
        </label>
        {warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gold-ink">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {rows && !rows.length && <p className="mt-3 text-sm text-ink-soft">The file has no product rows.</p>}
      </Card>

      {plan && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <Count n={plan.counts.create} label="new" tone="mor" />
            <Count n={plan.counts.update} label="to update" tone="royal" />
            <Count n={plan.counts.same} label="no change" tone="mute" />
            <Count n={plan.counts.error} label="problems" tone="gulal" />
            <div className="ml-auto">
              {plan.applied ? (
                <span className="rounded-full bg-mor-soft px-3 py-1.5 text-sm font-bold text-mor">Saved</span>
              ) : (
                <Button size="sm" disabled={!rows || save.isPending || plan.counts.error > 0 || plan.counts.create + plan.counts.update === 0} onClick={() => rows && save.mutate({ apply: true, rows })}>
                  {save.isPending ? <Spinner /> : `Save changes (${plan.counts.create + plan.counts.update})`}
                </Button>
              )}
            </div>
          </div>
          {plan.counts.error > 0 && <p className="bg-gulal-soft px-5 py-2 text-sm text-gulal">Fix the problems in the file and upload it again. Nothing can be saved while there are problems.</p>}
          {plan.newCategories.length > 0 && <p className="bg-gold-soft px-5 py-2 text-sm text-gold-ink">New categories will be made: {plan.newCategories.join(", ")}.</p>}
          <div className="flex gap-1 px-5 pt-3">
            {(["changes", "problems", "all"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setShow(v)} className={cn("rounded-full px-3 py-1 text-xs font-bold", show === v ? "bg-ink text-white" : "bg-sky text-ink-soft")}>
                {v === "changes" ? "Changes" : v === "problems" ? "Problems" : "Every row"}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={`${r.sheet}-${r.row}`} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", r.action === "create" ? "bg-mor-soft text-mor" : r.action === "update" ? "bg-sky text-royal" : r.action === "error" ? "bg-gulal-soft text-gulal" : "bg-line text-ink-soft")}>
                    {r.action === "create" ? "New" : r.action === "update" ? "Update" : r.action === "error" ? "Problem" : "No change"}
                  </span>
                  <b className="font-mono text-xs">{r.sku || "(no SKU)"}</b>
                  <span>{r.name}</span>
                  <span className="ml-auto text-xs text-ink-mute">
                    {r.sheet} row {r.row}
                  </span>
                </div>
                {r.errors.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-gulal">
                    {r.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                {r.changes.length > 0 && r.action !== "error" && (
                  <ul className="mt-1.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                    {r.changes.map((c) => (
                      <li key={c.field} className="min-w-0 truncate text-ink-soft" title={`${c.from} → ${c.to}`}>
                        <b className="text-ink">{c.field}:</b> {r.action === "create" ? c.to : <>{c.from || "empty"} → {c.to || "empty"}</>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {list.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-mute">Nothing to show here.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: "mor" | "royal" | "mute" | "gulal" }) {
  return (
    <span className={cn("text-sm", tone === "mor" ? "text-mor" : tone === "royal" ? "text-royal" : tone === "gulal" ? "text-gulal" : "text-ink-mute")}>
      <b className="text-xl">{n}</b> {label}
    </span>
  );
}

// ── 3. Downloads ────────────────────────────────────────────
const IST = 5.5 * 3600_000;
/** Start of a month in India time, as a UTC instant. */
const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m, 1) - IST);

function Downloads() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const dl = useCatalogueDownload();
  const now = new Date(Date.now() + IST);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const PERIODS = [
    { key: "this-month", label: "This month", from: monthStart(y, m), to: monthStart(y, m + 1) },
    { key: "last-month", label: "Last month", from: monthStart(y, m - 1), to: monthStart(y, m) },
    { key: "this-year", label: `This year (${y})`, from: monthStart(y, 0), to: monthStart(y + 1, 0) },
    { key: "last-year", label: `Last year (${y - 1})`, from: monthStart(y - 1, 0), to: monthStart(y, 0) },
    { key: "fy", label: `Financial year ${m >= 3 ? y : y - 1}–${String((m >= 3 ? y : y - 1) + 1).slice(2)}`, from: monthStart(m >= 3 ? y : y - 1, 3), to: monthStart((m >= 3 ? y : y - 1) + 1, 3) },
    { key: "all", label: "Everything so far", from: monthStart(2024, 0), to: monthStart(y, m + 1) },
  ];
  const [period, setPeriod] = useState("this-year");
  const [busy, setBusy] = useState(false);
  const p = PERIODS.find((x) => x.key === period)!;

  const report = async () => {
    setBusy(true);
    try {
      const data = await qc.fetchQuery({ ...trpc.admin.reportData.queryOptions({ from: p.from.toISOString(), to: p.to.toISOString() }), staleTime: 0 });
      const { buildReportWorkbook } = await import("@/lib/excel-report");
      const { downloadBlob } = await import("@/lib/excel-catalogue");
      downloadBlob(await buildReportWorkbook(data, p.label), `vedicvisa-stock-and-sales-${p.key}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="p-5">
        <FileSpreadsheet className="mb-2 size-7 text-mor" aria-hidden />
        <h2 className="font-sans text-lg font-bold">Catalogue</h2>
        <p className="mt-1 text-sm text-ink-soft">Every product and box as it is right now: names, prices, costs, stock, visibility, photos and box contents. The same file you upload, so it doubles as the template.</p>
        <Button className="mt-4" size="sm" onClick={() => dl.run(false)} disabled={dl.busy}>
          {dl.busy ? <Spinner /> : <Download className="size-4" aria-hidden />} Download catalogue
        </Button>
      </Card>
      <Card className="p-5">
        <LineChart className="mb-2 size-7 text-royal" aria-hidden />
        <h2 className="font-sans text-lg font-bold">Stock, sales and analytics report</h2>
        <p className="mt-1 text-sm text-ink-soft">A summary, then sales and profit by month and year; analytics for every product, category, state, city, customer, coupon, day, weekday and hour; stock in and out for every product (whole period and by month); the stock ledger, orders and order lines. Totals and shares are live Excel formulas.</p>
        <label className="mt-4 block text-sm font-bold" htmlFor="period">
          Period
        </label>
        <select id="period" value={period} onChange={(e) => setPeriod(e.target.value)} className="field mt-1 h-10 !py-1 text-base sm:text-sm">
          {PERIODS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
        <Button className="mt-3" size="sm" onClick={report} disabled={busy}>
          {busy ? <Spinner /> : <Download className="size-4" aria-hidden />} Download report
        </Button>
      </Card>
    </div>
  );
}
