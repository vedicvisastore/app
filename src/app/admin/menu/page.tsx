"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, PageLoader, Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { cn, storeHref } from "@/lib/utils";
import { Card, PageHeader, Toggle, useToast } from "../_ui";

type Cat = { slug: string; name: string; count: number };

export default function MenuPage() {
  const trpc = useTRPC();
  const settings = useQuery(trpc.admin.settings.queryOptions());
  const cats = useQuery(trpc.admin.categories.queryOptions());
  if (!settings.data || !cats.data) return <PageLoader />;
  const all: Cat[] = cats.data.map((c) => ({ slug: c.slug, name: c.name, count: c.count })).filter((c) => c.slug !== "bhakti-boxes-kits");
  return <Editor all={all} saved={settings.data.menuCategories} />;
}

function Editor({ all, saved }: { all: Cat[]; saved: string[] }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const auto = saved.length === 0;
  // Ordered list: chosen ones first in their saved order, then the rest (off).
  const start = auto
    ? all.map((c) => ({ ...c, on: c.count > 0 }))
    : [...saved.map((s) => all.find((c) => c.slug === s)).filter((c): c is Cat => !!c).map((c) => ({ ...c, on: true })), ...all.filter((c) => !saved.includes(c.slug)).map((c) => ({ ...c, on: false }))];
  const [rows, setRows] = useState(start);
  const [base, setBase] = useState(JSON.stringify(start));
  const dirty = JSON.stringify(rows) !== base;
  const save = useMutation(
    trpc.admin.saveMenu.mutationOptions({
      onSuccess: () => {
        setBase(JSON.stringify(rows));
        qc.invalidateQueries({ queryKey: trpc.admin.settings.queryKey() });
        toast("Shop menu updated in the store");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );
  const move = (i: number, by: number) =>
    setRows((xs) => {
      const next = [...xs];
      const [x] = next.splice(i, 1);
      next.splice(i + by, 0, x);
      return next;
    });
  const on = rows.filter((r) => r.on);

  return (
    <div className="w-full max-w-2xl pb-28">
      <PageHeader
        title="Shop menu"
        description="Choose which categories show under “Shop by category” when shoppers open the Shop menu (and in the phone menu), and in what order."
        actions={
          <a href={storeHref("/")} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-bold text-ink-soft hover:text-royal">
            See it on the store <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-sans text-lg font-bold">Categories in the menu</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Switch a category on to show it; use the arrows to change the order. A category with no products in the store is skipped automatically. To rename one, go to{" "}
          <Link href="/admin/categories" className="font-bold text-royal">
            Categories
          </Link>
          . The menu headings are in{" "}
          <Link href="/admin/content" className="font-bold text-royal">
            Store text
          </Link>{" "}
          (Header and menu).
        </p>
        <ol className="divide-y divide-line rounded-xl border border-line">
          {rows.map((r, i) => (
            <li key={r.slug} className={cn("flex items-center gap-3 px-3 py-2", !r.on && "bg-paper-2/60")}>
              <span className="w-6 text-center text-sm font-bold text-ink-mute">{r.on ? on.indexOf(r) + 1 : ""}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-bold", !r.on && "text-ink-soft")}>{r.name}</span>
                <span className="text-xs text-ink-mute">{r.count} {r.count === 1 ? "product" : "products"}</span>
              </span>
              <Toggle checked={r.on} onChange={(v) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, on: v } : x)))} label={r.on ? "Shown" : "Off"} />
              <button type="button" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sky disabled:opacity-30">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" aria-label={`Move ${r.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sky disabled:opacity-30">
                <ArrowDown className="size-4" />
              </button>
            </li>
          ))}
        </ol>
        {!auto && (
          <button type="button" className="mt-4 text-sm font-bold text-royal" disabled={save.isPending} onClick={() => { setRows(all.map((c) => ({ ...c, on: c.count > 0 }))); save.mutate({ categories: [] }); }}>
            Go back to automatic (every category, in Categories order)
          </button>
        )}
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">{dirty ? "You have unsaved changes" : auto ? "Automatic menu" : "All changes saved"} · {on.length} shown</p>
          <Button size="sm" disabled={!dirty || save.isPending || on.length === 0} onClick={() => save.mutate({ categories: on.map((r) => r.slug) })}>
            {save.isPending ? <Spinner /> : "Save menu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
