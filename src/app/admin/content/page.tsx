"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { CONTENT_GROUPS } from "@/content/defaults";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Card, PageHeader, useToast } from "../_ui";

export default function ContentPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery(trpc.admin.siteConfig.queryOptions());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [group, setGroup] = useState<string>(CONTENT_GROUPS[0].key);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (data) setEdits(data.content ?? {});
  }, [data]);
  const save = useMutation(
    trpc.admin.saveContent.mutationOptions({
      onSuccess: (r) => {
        qc.invalidateQueries({ queryKey: trpc.admin.siteConfig.queryKey() });
        toast(`Saved. ${r.saved} ${r.saved === 1 ? "change is" : "changes are"} live within 30 seconds.`);
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  const dirty = useMemo(() => JSON.stringify(edits) !== JSON.stringify(data?.content ?? {}), [edits, data]);
  const editedCount = Object.values(edits).filter((v) => v.trim()).length;
  const search = q.trim().toLowerCase();
  const groups = CONTENT_GROUPS.filter((g) => (search ? true : g.key === group));

  if (isLoading || !data) return <Spinner className="text-ink-mute" />;

  return (
    <>
      <PageHeader
        title="Store text"
        description="Change any wording on the store. Leave a box empty to use the original. Words in {braces} are filled in automatically (prices, counts), so keep them."
        actions={
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ content: edits })}>
            {save.isPending && <Spinner />} Save changes
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CONTENT_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => { setGroup(g.key); setQ(""); }}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm", !search && group === g.key ? "border-shyam bg-shyam text-on-shyam" : "border-line text-ink-soft hover:text-ink")}
          >
            {g.label}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all text" className="field ml-auto !min-h-10 max-w-60 !py-1.5" aria-label="Search all text" />
      </div>
      <p className="mb-4 text-sm text-ink-mute">{editedCount} {editedCount === 1 ? "line differs" : "lines differ"} from the original.</p>

      <div className="space-y-6">
        {groups.map((g) => {
          const fields = Object.entries(g.fields).filter(([k, f]) => !search || `${f.label} ${f.value} ${edits[`${g.key}.${k}`] ?? ""}`.toLowerCase().includes(search));
          if (!fields.length) return null;
          return (
            <Card key={g.key} className="p-5">
              <h2 className="font-sans text-lg font-bold">{g.label}</h2>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                {fields.map(([k, f]) => {
                  const key = `${g.key}.${k}`;
                  const value = edits[key] ?? "";
                  const hint = "hint" in f ? (f.hint as string) : undefined;
                  const long = f.value.length > 70;
                  return (
                    <label key={key} className="block">
                      <span className="label flex items-center justify-between gap-2">
                        {f.label}
                        {value.trim() && (
                          <button type="button" className="inline-flex items-center gap-1 text-xs font-normal text-ink-mute hover:text-ink" onClick={(e) => { e.preventDefault(); setEdits((s) => { const n = { ...s }; delete n[key]; return n; }); }}>
                            <RotateCcw className="size-3" /> Original
                          </button>
                        )}
                      </span>
                      {long ? (
                        <textarea rows={3} maxLength={600} className="field" placeholder={f.value} value={value} onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))} />
                      ) : (
                        <input maxLength={600} className="field" placeholder={f.value} value={value} onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))} />
                      )}
                      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
                    </label>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
