import type { Metadata } from "next";
import { BadgePercent, Truck } from "lucide-react";
import { ProductCard } from "@/components/product/cards";
import { PageIntro, ProductGrid, SectionTitle } from "@/components/site/page-intro";
import { ButtonLink, Container } from "@/components/ui";
import { formatDate, inr } from "@/lib/utils";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";

export const metadata: Metadata = { title: "Deals", description: "Every VedicVisa offer running right now." };

type Offer = { id: number; name: string; type: string; value: number; minSubtotal: number; maxDiscount: number | null; endsAt: Date | null };

function offerLine(o: Offer) {
  const min = o.minSubtotal > 0 ? ` on orders above ${inr(o.minSubtotal)}` : " on every order";
  if (o.type === "free_shipping") return `Free shipping${min}`;
  if (o.type === "percent") return `${o.value}% off${min}${o.maxDiscount ? ` (up to ${inr(o.maxDiscount)})` : ""}`;
  return `${inr(o.value)} off${min}`;
}

export default async function DealsPage() {
  const trpc = await api();
  const [{ products, offers }, { content }] = await Promise.all([trpc.catalog.deals(), getSite()]);
  const c = content.pages;
  return (
    <>
      <PageIntro title={c.dealsTitle} lede={c.dealsLede} />
      <Container className="mt-12 space-y-16">
        {offers.length > 0 && (
          <section>
            <SectionTitle>{c.dealsOffersTitle}</SectionTitle>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <li key={o.id} className="flex gap-4 rounded-2xl border border-line bg-paper-2 p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gulal text-white">
                    {o.type === "free_shipping" ? <Truck className="size-5" aria-hidden /> : <BadgePercent className="size-5" aria-hidden />}
                  </span>
                  <div>
                    <p className="font-bold">{offerLine(o)}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {o.name}
                      {o.endsAt && ` · ends ${formatDate(o.endsAt)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {products.length > 0 ? (
          <section>
            <SectionTitle aside={<p className="text-sm text-ink-soft">{products.length} on offer</p>}>On sale</SectionTitle>
            <ProductGrid>
              {products.map((p, i) => (
                <ProductCard key={p.id} p={p} priority={i < 4} />
              ))}
            </ProductGrid>
          </section>
        ) : (
          offers.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="max-w-md text-lg text-ink-soft">{c.dealsEmpty}</p>
              <ButtonLink href="/shop" className="mt-6">
                {content.nav.shopAll}
              </ButtonLink>
            </div>
          )
        )}
      </Container>
    </>
  );
}
