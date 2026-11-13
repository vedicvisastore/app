"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { Card, ConfirmButton, Field, PageHeader, td, th, useToast } from "../_ui";

type Draft = { id?: number; name: string; description: string; sortOrder: number };

export default function CategoriesPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery(trpc.admin.categories.queryOptions());
  const [d, setD] = useState<Draft>({ name: "", description: "", sortOrder: 0 });
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.admin.categories.queryKey() });
  const save = useMutation(trpc.admin.saveCategory.mutationOptions({ onSuccess: () => { invalidate(); toast(d.id ? "Category updated" : "Category added"); setD({ name: "", description: "", sortOrder: 0 }); }, onError: (e) => toast(e.message, "error") }));
  const del = useMutation(trpc.admin.deleteCategory.mutationOptions({ onSuccess: () => { invalidate(); toast("Category deleted. Its products are now uncategorised."); } }));

  return (
    <>
      <PageHeader title="Categories" description="Shoppers filter the shop by these. Lower sort numbers appear first." />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-sky/40"><th className={th}>Name</th><th className={th}>Description</th><th className={th}>Products</th><th className={th}>Sort</th><th className={th} /></tr></thead>
            <tbody>
              {isLoading && <tr><td className={td} colSpan={5}><Spinner className="text-ink-mute" /></td></tr>}
              {data?.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className={`${td} font-bold`}>{c.name}<p className="text-xs font-normal text-ink-mute">/shop?category={c.slug}</p></td>
                  <td className={`${td} max-w-xs text-ink-soft`}>{c.description ?? "—"}</td>
                  <td className={td}><Link href="/admin/products" className="text-royal">{c.count}</Link></td>
                  <td className={`${td} tabular-nums`}>{c.sortOrder}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <button className="mr-3 font-bold text-royal" onClick={() => setD({ id: c.id, name: c.name, description: c.description ?? "", sortOrder: c.sortOrder })}>Edit</button>
                    <ConfirmButton onConfirm={() => del.mutate({ id: c.id })} confirmLabel="Delete" className="font-bold text-ink-mute hover:text-gulal">Delete</ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="h-fit space-y-4 p-5">
          <h2 className="font-sans text-lg font-bold">{d.id ? "Edit category" : "Add a category"}</h2>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ ...d, description: d.description || null }); }}>
            <Field label="Name"><input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className="field" /></Field>
            <Field label="Description" hint="Shown at the top of the category page"><textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} rows={3} className="field" /></Field>
            <Field label="Sort order"><input type="number" value={d.sortOrder} onChange={(e) => setD({ ...d, sortOrder: Number(e.target.value) || 0 })} className="field" /></Field>
            <div className="flex gap-2">
              <Button size="sm" disabled={save.isPending}>{d.id ? "Save category" : "Add category"}</Button>
              {d.id && <Button size="sm" type="button" variant="ghost" onClick={() => setD({ name: "", description: "", sortOrder: 0 })}>Cancel</Button>}
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
