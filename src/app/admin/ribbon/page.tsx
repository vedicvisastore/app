"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Link2, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import type { RibbonItem } from "@/lib/settings-defaults";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Card, PageHeader, useToast } from "../_ui";

const SPEEDS = [
  { label: "Slow", seconds: 60 },
  { label: "Normal", seconds: 40 },
  { label: "Fast", seconds: 25 },
];

const IDEAS = ["Free shipping on orders above ₹999", "New: Tulsi japa mala", "Delivered to every pincode by India Post", "Use code JAISHRIKRISHNA for 10% off"];

export default function RibbonPage() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.admin.settings.queryOptions());
  if (!data) return <Spinner className="text-ink-mute" />;
  return <Editor initialItems={data.ribbon} initialSeconds={data.ribbonSeconds} />;
}

function Editor({ initialItems, initialSeconds }: { initialItems: RibbonItem[]; initialSeconds: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const [items, setItems] = useState<RibbonItem[]>(initialItems);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [saved, setSaved] = useState(JSON.stringify([initialItems, initialSeconds]));
  const dirty = JSON.stringify([items, seconds]) !== saved;
  const save = useMutation(
    trpc.admin.saveRibbon.mutationOptions({
      onSuccess: () => {
        setSaved(JSON.stringify([items, seconds]));
        qc.invalidateQueries({ queryKey: trpc.admin.settings.queryKey() });
        toast("Ribbon updated in the store");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  const update = (i: number, patch: Partial<RibbonItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, by: number) =>
    setItems((xs) => {
      const next = [...xs];
      const [x] = next.splice(i, 1);
      next.splice(i + by, 0, x);
      return next;
    });
  const clean = items.map((i) => ({ text: i.text.trim(), href: i.href?.trim() || undefined })).filter((i) => i.text);

  return (
    <div className="w-full pb-28">
      <PageHeader title="Top ribbon" description="The strip that scrolls across the very top of the store. Each message can link to a page, like /deals or /c/corporate-gifting." />

      {/* Preview */}
      <p className="label">Preview</p>
      <div className="marquee-wrap mb-8 overflow-hidden rounded-xl bg-royal text-white">
        {clean.length ? (
          <div className="marquee py-2.5 text-[0.8125rem]" style={{ animationDuration: `${seconds}s` }}>
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0" aria-hidden={k === 1}>
                {Array.from({ length: Math.max(2, Math.ceil(8 / clean.length)) }).flatMap((_, a) =>
                  clean.map((r, b) => (
                    <span key={`${a}-${b}`} className={cn("flex items-center gap-6 pr-6 whitespace-nowrap", r.href && "underline decoration-white/40 underline-offset-4")}>
                      {r.text}
                      <svg viewBox="0 0 10 10" className="size-2 fill-gold" aria-hidden>
                        <path d="M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z" />
                      </svg>
                    </span>
                  )),
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2.5 text-center text-sm text-white/80">No messages: the ribbon is hidden in the store.</p>
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-sans text-lg font-bold">Messages</h2>
          <span className="text-sm text-ink-mute">{items.length} of 12</span>
        </div>
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2.5 w-5 shrink-0 text-center text-sm font-bold text-ink-mute">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input value={it.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="Message" maxLength={120} className="field" aria-label={`Message ${i + 1}`} />
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-line px-3 focus-within:border-royal">
                    <Link2 className="size-4 shrink-0 text-ink-mute" aria-hidden />
                    <input value={it.href ?? ""} onChange={(e) => update(i, { href: e.target.value })} placeholder="Link (optional): /deals" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label={`Link for message ${i + 1}`} />
                  </label>
                </div>
                <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-4" />
                  </IconBtn>
                  <IconBtn label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-4" />
                  </IconBtn>
                  <IconBtn label="Remove" danger onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </IconBtn>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={items.length >= 12}
          onClick={() => setItems((xs) => [...xs, { text: "" }])}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm font-bold text-royal hover:border-royal disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden /> Add a message
        </button>

        <div className="mt-5">
          <p className="mb-2 text-sm text-ink-soft">Ideas, tap to add:</p>
          <div className="flex flex-wrap gap-2">
            {IDEAS.filter((t) => !items.some((x) => x.text === t)).map((t) => (
              <button key={t} type="button" disabled={items.length >= 12} onClick={() => setItems((xs) => [...xs, { text: t }])} className="rounded-full bg-sky px-3 py-1.5 text-sm text-ink-soft hover:text-ink">
                + {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="mb-3 font-sans text-lg font-bold">Speed</h2>
        <div className="inline-flex rounded-full bg-sky p-1" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s.seconds} type="button" role="radio" aria-checked={seconds === s.seconds} onClick={() => setSeconds(s.seconds)} className={cn("h-9 rounded-full px-4 text-sm font-bold", seconds === s.seconds ? "bg-paper text-ink shadow-lift" : "text-ink-soft")}>
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur lg:left-[248px]">
        <div className="flex items-center justify-between gap-3 lg:px-6">
          <p className="text-sm text-ink-soft">{dirty ? "You have unsaved changes" : "All changes saved"}</p>
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ items: clean, seconds })}>
            {save.isPending ? <Spinner /> : "Save ribbon"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={cn("grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sky disabled:opacity-30", danger && "hover:bg-gulal-soft hover:text-gulal")}>
      {children}
    </button>
  );
}
