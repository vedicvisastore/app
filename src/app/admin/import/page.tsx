"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import type { ParsedSheet } from "@/lib/excel-import";
import { useTRPC } from "@/lib/trpc/client";
import { Card, PageHeader, td, th, useToast } from "../_ui";

export default function ImportPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useMutation(
    trpc.admin.importSheet.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.admin.products.queryKey() });
        toast("Import finished");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  async function read(file: File) {
    setError(null);
    setParsed(null);
    run.reset();
    setReading(true);
    setFileName(file.name);
    try {
      // Parsed in the browser so the server stays light (works on free serverless tiers).
      const { parseWorkbook } = await import("@/lib/excel-import");
      setParsed(await parseWorkbook(await file.arrayBuffer()));
    } catch (e) {
      setError((e as Error).message);
    }
    setReading(false);
  }

  return (
    <>
      <PageHeader title="Import from Excel" description="Upload your product sheet in the same layout as VedicvisaStore.xlsx. You'll see a preview before anything changes." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit space-y-4 p-5">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong p-8 text-center hover:border-royal">
            {reading ? <Spinner /> : <FileSpreadsheet className="size-8 text-mor" />}
            <span className="font-bold">{fileName || "Choose an .xlsx file"}</span>
            <span className="text-xs text-ink-mute">Nothing is saved until you press Import</span>
            <input type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          </label>
          <div className="text-sm text-ink-soft">
            <p className="font-bold text-ink">How it matches</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Products are matched by name. Existing ones get the new cost and price; photos, descriptions, stock and visibility stay as they are.</li>
              <li>Packing, filling, outer and delivery categories become internal items: counted in box cost, never sold alone.</li>
              <li>Each box column (Hari Bhakti Box, Japa Set A…) becomes a bundle with its ticked items and the MRP/SP from the bottom rows.</li>
              <li>New store items go live straight away, so add photos and check them after importing.</li>
            </ul>
          </div>
          {error && <p className="rounded-lg bg-gulal-soft px-3 py-2 text-sm text-gulal">{error}</p>}
        </Card>

        {parsed && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans text-lg font-bold">
                Preview: {parsed.products.length} products, {parsed.bundles.length} boxes
              </h2>
              <Button disabled={run.isPending || !!run.data} onClick={() => run.mutate(parsed)}>
                {run.isPending && <Spinner />} {run.data ? "Imported" : "Import"}
              </Button>
            </div>
            {run.data && (
              <div className="mt-4 rounded-xl bg-mor-soft p-4 text-sm text-mor">
                Created {run.data.productsCreated} and updated {run.data.productsUpdated} products. Created {run.data.bundlesCreated} and updated {run.data.bundlesUpdated} boxes.
                {run.data.warnings.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-ink-soft">
                    {run.data.warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                )}
              </div>
            )}
            <h3 className="mt-5 text-sm font-bold text-ink-soft">Boxes</h3>
            <div className="overflow-x-auto">
              <table className="mt-1 w-full text-sm">
                <thead><tr className="border-b border-line"><th className={th}>Box</th><th className={th}>Group</th><th className={th}>Items</th><th className={`${th} text-right`}>MRP</th><th className={`${th} text-right`}>Price</th></tr></thead>
                <tbody>
                  {parsed.bundles.map((b) => (
                    <tr key={b.name} className="border-b border-line last:border-0">
                      <td className={`${td} font-bold`}>{b.name}</td><td className={td}>{b.group}</td><td className={td}>{b.items.length}</td>
                      <td className={`${td} text-right tabular-nums`}>{b.mrp != null ? `₹${b.mrp}` : "—"}</td><td className={`${td} text-right tabular-nums`}>{b.price != null ? `₹${b.price}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-5 text-sm font-bold text-ink-soft">Products</h3>
            <div className="max-h-96 overflow-auto">
              <table className="mt-1 w-full text-sm">
                <thead className="sticky top-0 bg-paper"><tr className="border-b border-line"><th className={th}>SKU</th><th className={th}>Name</th><th className={th}>Category</th><th className={`${th} text-right`}>Cost</th><th className={`${th} text-right`}>Price</th></tr></thead>
                <tbody>
                  {parsed.products.map((p, i) => (
                    <tr key={`${p.name}-${i}`} className="border-b border-line last:border-0">
                      <td className={`${td} font-mono text-xs`}>{p.sku}</td><td className={td}>{p.name}</td><td className={`${td} text-ink-soft`}>{p.category}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{p.cost}</td><td className={`${td} text-right tabular-nums`}>₹{p.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
