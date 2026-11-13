"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { customTokens, DEFAULT_CUSTOM, THEMES, themeTokens, type CustomTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Card, PageHeader, useToast } from "../_ui";

/** A miniature of the storefront painted with a theme's tokens (scoped to this box only). */
function Preview({ tokens }: { tokens: Record<string, string> }) {
  return (
    <div style={tokens as React.CSSProperties} className="overflow-hidden rounded-xl border border-line bg-paper p-2.5" aria-hidden>
      <div className="grid h-36 grid-cols-5 grid-rows-2 gap-1.5">
        <div className="col-span-3 row-span-2 flex flex-col justify-between rounded-lg bg-royal p-2.5">
          <span className="font-display text-[0.65rem] text-gold">धार्यते इति धर्मः</span>
          <span className="font-display text-base leading-tight text-white">Bhakti, beautifully boxed.</span>
          <span className="w-fit rounded-full bg-gold px-2 py-0.5 text-[0.55rem] font-bold text-shyam">Shop Bhakti Boxes</span>
        </div>
        <div className="col-span-2 rounded-lg bg-paper-2 bg-[url('/brand/vrindavan-box.jpg')] bg-cover bg-center" />
        <div className="rounded-lg bg-peacock" />
        <div className="rounded-lg bg-gulal" />
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-lg bg-shyam px-2.5 py-1.5">
        <span className="font-display text-[0.6rem] text-gold">VedicVisa</span>
        <span className="text-[0.55rem] text-on-shyam-2">Footer</span>
      </div>
    </div>
  );
}

const COLOR_FIELDS: { key: keyof CustomTheme; label: string; hint: string }[] = [
  { key: "field", label: "Deep band", hint: "Footer, dark sections. Keep it dark." },
  { key: "primary", label: "Main colour", hint: "Hero tile, links. White text sits on it." },
  { key: "button", label: "Buttons", hint: "Filled buttons. Keep it light." },
  { key: "accent", label: "Accent", hint: "Sale tags, second colour tile." },
  { key: "paper", label: "Background", hint: "Page background. Keep it very light." },
];

export default function ThemesPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery(trpc.admin.siteConfig.queryOptions());
  const [custom, setCustom] = useState<CustomTheme>(DEFAULT_CUSTOM);
  useEffect(() => {
    if (data?.customTheme) setCustom(data.customTheme);
  }, [data?.customTheme]);
  const save = useMutation(
    trpc.admin.saveTheme.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.admin.siteConfig.queryKey() });
        toast("Theme saved. The store shows it within 30 seconds.");
      },
      onError: (e) => toast(e.message, "error"),
    }),
  );

  if (isLoading || !data) return <Spinner className="text-ink-mute" />;
  const active = data.theme;

  return (
    <>
      <PageHeader
        title="Themes"
        description="Switch the whole store's colours in one click. Products, photos and text stay the same. Saved to storage, not the database, and live within about 30 seconds."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((t) => {
          const on = active === t.key;
          return (
            <Card key={t.key} className={cn("flex flex-col p-4", on && "outline-2 outline-royal")}>
              <Preview tokens={themeTokens(t.key)} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">{t.name}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{t.mood}</p>
                </div>
                {on && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mor-soft px-2.5 py-1 text-xs font-bold text-mor"><Check className="size-3.5" /> Live</span>}
              </div>
              <Button className="mt-4 self-start" size="sm" variant={on ? "outline" : "primary"} disabled={on || save.isPending} onClick={() => save.mutate({ theme: t.key })}>
                {on ? "In use" : "Use this theme"}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8 p-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h2 className="font-sans text-lg font-bold">Your own colours</h2>
            <p className="mt-1 text-sm text-ink-soft">Pick five colours; every shade on the site is mixed from them. The preview updates as you pick.</p>
            <div className="mt-5 space-y-4">
              {COLOR_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-4">
                  <input type="color" value={custom[f.key]} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-paper p-1" />
                  <span>
                    <span className="block font-bold">{f.label}</span>
                    <span className="block text-sm text-ink-soft">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button disabled={save.isPending} onClick={() => save.mutate({ theme: "custom", customTheme: custom })}>
                {save.isPending && <Spinner />} {active === "custom" ? "Save my colours" : "Use my colours"}
              </Button>
              <Button variant="ghost" onClick={() => setCustom(DEFAULT_CUSTOM)}>Reset</Button>
            </div>
          </div>
          <div>
            <Preview tokens={customTokens(custom)} />
            {active === "custom" && <p className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-mor"><Check className="size-4" /> Your colours are live</p>}
          </div>
        </div>
      </Card>
    </>
  );
}
