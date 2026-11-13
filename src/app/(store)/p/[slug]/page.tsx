import { TRPCError } from "@trpc/server";
import { Package, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product/cards";
import { Badge, Container, Media, Price, ProductArt } from "@/components/ui";
import { inr, launchLabel } from "@/lib/utils";
import { socialUrl } from "@/lib/settings-defaults";
import { api } from "@/server/caller";
import { BuyBox } from "./buy-box";
import { fmt } from "@/content/defaults";
import { getSite } from "@/server/site-config";
import { Gallery } from "./gallery";
import { PincodeCheck } from "./pincode-check";

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  const trpc = await api();
  try {
    return await trpc.catalog.product({ slug });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const trpc = await api();
  const p = await trpc.catalog.spotlight({ slug }).catch(() => null);
  if (!p) return { title: "Not found" };
  return { title: p.name, description: p.tagline ?? p.description?.slice(0, 155), openGraph: { images: p.images[0] ? [p.images[0]] : undefined } };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const trpc = await api();
  const [all, settings, { content }] = await Promise.all([trpc.catalog.list({}), trpc.catalog.settings(), getSite()]);
  const c = content.product;
  const related = all
    .filter((x) => x.id !== p.id && (p.kind === "bundle" ? x.bundleGroup === p.bundleGroup : x.categorySlug === p.categorySlug))
    .concat(all.filter((x) => x.id !== p.id && x.kind === "bundle" && p.kind === "single" && p.partOf.some((b) => b.slug === x.slug)))
    .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
    .slice(0, 4);
  const saving = p.worth - p.price;

  return (
    <>
      <Container className="grid gap-10 pt-8 md:grid-cols-2 lg:gap-16">
        <div className="md:col-span-2"><nav aria-label="Breadcrumb" className="text-sm text-ink-mute">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/shop" className="hover:text-royal">Shop</Link></li>
            <li aria-hidden>/</li>
            {p.kind === "bundle" && p.bundleGroup ? (
              <li><Link href={`/shop?group=${p.bundleGroup.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-royal">{p.bundleGroup}</Link></li>
            ) : p.categorySlug ? (
              <li><Link href={`/shop?category=${p.categorySlug}`} className="hover:text-royal">{p.categoryName}</Link></li>
            ) : null}
          </ol>
        </nav></div>
        <Gallery images={p.images} name={p.name} seed={p.id} />

        <div className="md:sticky md:top-28 md:self-start">
          <div className="flex flex-wrap gap-2">
            {p.upcoming && <Badge tone="haldi">{launchLabel(p.launchAt)}</Badge>}
            {p.saleLabel && !p.upcoming && <Badge tone="gulal">{p.saleLabel}</Badge>}
          </div>
          <h1 className="mt-3 text-[length:var(--text-display-s)]">{p.name}</h1>
          {p.tagline && <p className="mt-2 text-lg text-ink-soft">{p.tagline}</p>}
          <div className="mt-5">
            <Price price={p.price} mrp={p.mrp} size="lg" />
            {saving > 0 && <p className="mt-1 text-sm font-normal text-mor">Worth {inr(p.worth)} if bought separately. You save {inr(saving)}.</p>}
          </div>

          <BuyBox productId={p.id} available={p.available} name={p.name} upcoming={p.upcoming ? launchLabel(p.launchAt) : null} instagram={socialUrl("instagram", settings.instagram)} />

          <div className="mt-6 space-y-3 rounded-2xl border border-line p-4">
            <PincodeCheck daysMin={settings.deliveryDaysMin} daysMax={settings.deliveryDaysMax} />
            <p className="flex items-start gap-3 text-sm text-ink-soft">
              <Package className="mt-0.5 size-4 shrink-0 text-yamuna" aria-hidden />
              {settings.freeShippingThreshold > 0
                ? fmt(c.freeShipping, { threshold: inr(settings.freeShippingThreshold), fee: inr(settings.shippingFee) })
                : c.alwaysFree}
            </p>
            <p className="flex items-start gap-3 text-sm text-ink-soft">
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-yamuna" aria-hidden />
              {c.damaged}
            </p>
          </div>

          {p.description && (
            <div className="mt-8">
              <h2 className="font-sans text-lg font-bold">{p.kind === "bundle" ? c.aboutBox : c.aboutProduct}</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-soft">{p.description}</p>
            </div>
          )}

          {p.partOf.length > 0 && (
            <p className="mt-6 text-sm text-ink-soft">
              Also included in{" "}
              {p.partOf.map((b, i) => (
                <span key={b.slug}>
                  {i > 0 && (i === p.partOf.length - 1 ? " and " : ", ")}
                  <Link href={`/p/${b.slug}`} className="font-bold text-royal hover:underline">
                    {b.name}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </div>
      </Container>

      {p.components.length > 0 && (
        <section className="pt-[var(--section-gap)]" aria-labelledby="contents" data-tint="gold">
          <Container>
            <h2 id="contents">
              {c.insideTitle}
            </h2>
            <p className="mt-2 text-ink-soft">{c.insideLede}</p>
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-6">
              {p.components.map((c) => (
                <li key={c.id}>
                  <div className="group">
                    <Link href={`/p/${c.slug}`} aria-label={c.name} className="relative block aspect-square overflow-hidden rounded-2xl bg-sky">
                      {c.image ? <Media src={c.image} alt={c.name} className="h-full w-full object-cover" /> : <ProductArt name={c.name} seed={c.id} />}
                    </Link>
                    <p className="mt-3 text-sm leading-snug font-bold group-hover:text-royal">
                      <Link href={`/p/${c.slug}`}>{c.qty > 1 && `${c.qty} × `}{c.name}</Link>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-[var(--section-gap)] -mb-[var(--section-gap-s)] bg-paper-2 pt-[var(--section-gap-s)] pb-[calc(var(--section-gap-s)*0.75)]" aria-labelledby="related" data-tint="peacock">
          <Container>
            <h2 id="related">
              {c.relatedTitle}
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 lg:gap-x-6">
              {related.map((r) => (
                <ProductCard key={r.id} p={r} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
