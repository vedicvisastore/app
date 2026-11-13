import type { Metadata } from "next";
import { ProductCard } from "@/components/product/cards";
import { PageIntro, ProductGrid, SectionTitle } from "@/components/site/page-intro";
import { ButtonLink, Container } from "@/components/ui";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";

export const metadata: Metadata = { title: "New launches", description: "The newest VedicVisa products and what's launching soon." };

export default async function NewPage() {
  const trpc = await api();
  const [all, { content }] = await Promise.all([trpc.catalog.list({ sort: "new" }), getSite()]);
  const c = content.pages;
  const soon = all.filter((p) => p.upcoming);
  const fresh = all.filter((p) => !p.upcoming).slice(0, 12);
  return (
    <>
      <PageIntro title={c.newTitle} lede={c.newLede} />
      <Container className="mt-12 space-y-16">
        {soon.length > 0 && (
          <section>
            <SectionTitle>{c.newSoonTitle}</SectionTitle>
            <ProductGrid>
              {soon.map((p, i) => (
                <ProductCard key={p.id} p={p} priority={i < 4} />
              ))}
            </ProductGrid>
          </section>
        )}
        <section>
          <SectionTitle aside={<ButtonLink href="/shop?sort=new" variant="ghost" size="sm">{content.nav.shopAll}</ButtonLink>}>{c.newJustTitle}</SectionTitle>
          <ProductGrid>
            {fresh.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={!soon.length && i < 4} />
            ))}
          </ProductGrid>
        </section>
      </Container>
    </>
  );
}
