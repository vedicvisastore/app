"use client";
import Link from "next/link";
import { useState } from "react";
import { QuickAdd } from "@/components/product/quick-add";
import { Container, Price } from "@/components/ui";
import type { CardProduct } from "@/server/catalog";
import { cn, launchLabel } from "@/lib/utils";
import { useContent } from "@/components/site/content-context";


export function SetSwitcher({ japa, shringar }: { japa: CardProduct[]; shringar: CardProduct[] }) {
  const c = useContent().home;
  const TABS = [
    { key: "japa", label: c.setsJapaTab, word: "जप", line: c.setsJapaLine },
    { key: "shringar", label: c.setsShringarTab, word: "श्रृंगार", line: c.setsShringarLine },
  ] as const;
  const [tab, setTab] = useState<"japa" | "shringar">(japa.length ? "japa" : "shringar");
  const t = TABS.find((x) => x.key === tab)!;

  return (
    <section className="mt-[var(--section-gap-l)] bg-paper-2 py-[var(--section-gap-s)]" aria-labelledby="sets">
      <Container className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="deva text-[clamp(4.5rem,10vw,9rem)] leading-none text-paper-3" aria-hidden lang="sa">
            {t.word}
          </p>
          <h2 id="sets" className="-mt-6">
            {c.setsTitle}
          </h2>
          <div className="mt-8 inline-flex rounded-full bg-paper p-1" role="tablist" aria-label="Set type">
            {TABS.map((x) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={tab === x.key}
                onClick={() => setTab(x.key)}
                className={cn("h-10 rounded-full px-5 text-sm font-bold transition-colors duration-[var(--dur-short)]", tab === x.key ? "bg-shyam text-on-shyam" : "text-ink-soft hover:text-ink")}
              >
                {x.label}
              </button>
            ))}
          </div>
          <p className="mt-6 max-w-[38ch] text-ink-soft">{t.line}</p>
        </div>
        <div className="lg:col-span-7">
          {TABS.map((x) => (
            <ul key={x.key} role="tabpanel" aria-label={x.label} hidden={tab !== x.key}>
              {(x.key === "japa" ? japa : shringar).map((p) => (
                <li key={p.id} className="flex items-center gap-6 border-b border-rule py-6 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${p.slug}`} className="font-display text-[length:var(--text-title)] leading-tight hover:text-royal">
                      {p.name}
                    </Link>
                    {p.tagline && <p className="mt-1 text-sm text-ink-soft">{p.tagline}</p>}
                  </div>
                  <Price price={p.price} mrp={p.mrp} size="sm" className="justify-end text-right" />
                  {p.upcoming ? <span className="text-sm font-bold whitespace-nowrap text-gold-ink">{launchLabel(p.launchAt)}</span> : <QuickAdd productId={p.id} name={p.name} disabled={p.available === 0} />}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </Container>
    </section>
  );
}
