import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product/cards";
import { Toran } from "@/components/site/ornaments";
import { ProductGrid } from "@/components/site/page-intro";
import { ButtonLink, Container, Media } from "@/components/ui";
import { fmt } from "@/content/defaults";
import { ACCENT_BAND, festivalDay } from "@/lib/festival-accent";
import { cn } from "@/lib/utils";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  try {
    return await (await api()).catalog.festival({ slug });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const f = await load((await params).slug);
  return f ? { title: f.name, description: f.tagline ?? undefined } : { title: "Festival" };
}

export default async function FestivalPage({ params }: { params: Params }) {
  const f = await load((await params).slug);
  if (!f) notFound();
  const { content } = await getSite();
  const c = content.pages;
  const day = festivalDay(f.festivalDate);
  return (
    <>
      <section className={cn("relative overflow-hidden", ACCENT_BAND[f.accent] ?? ACCENT_BAND.gulal)}>
        <Toran id="toran-custom-page" className="absolute inset-x-0 top-0" />
        <span className="deva pointer-events-none absolute -right-6 -bottom-10 text-[9rem] leading-none opacity-15 select-none sm:text-[14rem]" aria-hidden lang="hi">
          उत्सव
        </span>
        <Container className={cn("relative grid items-center gap-8 pt-16 pb-12 sm:pt-20 sm:pb-16", f.image && "md:grid-cols-[1.2fr_1fr]")}>
          <div>
            {day && <p className="mb-3 text-sm font-bold opacity-85">{fmt(c.festivalOn, { name: f.name, date: day })}</p>}
            <h1 className="text-[length:var(--text-display-s)]">{f.name}</h1>
            {f.tagline && <p className="lead mt-3 opacity-90">{f.tagline}</p>}
          </div>
          {f.image && (
            <div className="arch mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden md:max-w-sm">
              <Media src={f.image} alt={f.name} priority className="size-full object-cover" />
            </div>
          )}
        </Container>
      </section>

      <Container className="mt-12">
        {f.description && <p className="mb-12 max-w-2xl text-lg whitespace-pre-line text-ink-soft">{f.description}</p>}
        {f.products.length ? (
          <ProductGrid>
            {f.products.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </ProductGrid>
        ) : (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="max-w-md text-lg text-ink-soft">{c.festivalEmpty}</p>
            <ButtonLink href="/shop" className="mt-6">
              {content.nav.shopAll}
            </ButtonLink>
          </div>
        )}
      </Container>
    </>
  );
}
