import { OrnamentDivider } from "@/components/site/ornament";
import Image from "next/image";
import "./home.css";
import Link from "next/link";
import { BoxCard, ProductCard } from "@/components/product/cards";
import { ButtonLink, Container, Media, ProductArt } from "@/components/ui";
import { socialHandle, socialUrl } from "@/lib/settings-defaults";
import { cn, inr, launchLabel } from "@/lib/utils";
import { api } from "@/server/caller";
import { fmt } from "@/content/defaults";
import { getSite } from "@/server/site-config";
import { InstagramBadge, YoutubeBadge } from "@/components/site/social";
import { SetSwitcher } from "./set-switcher";
import { HeroBanner, type BannerProduct, type BannerSlide } from "./hero-banner";
import { HomePicks } from "./home-picks";
import { automaticHeroSlides, HERO_PRODUCTS, HERO_SCENE } from "@/lib/hero-slides";

const ESSENTIAL_ORDER = ["jap-mala", "kanthi-mala", "japa-bags", "tilak-chandan", "itra-fragrance", "japa-accessories", "books"];

export default async function Home() {
  const trpc = await api();
  const [all, settings, { content, images }, deals, categories] = await Promise.all([trpc.catalog.list({}), trpc.catalog.settings(), getSite(), trpc.catalog.deals(), trpc.catalog.categories()]);
  const c = content.home;
  const boxes = all.filter((p) => p.bundleGroup === "Bhakti Boxes");
  const japa = all.filter((p) => p.bundleGroup === "Japa Sets");
  const shringar = all.filter((p) => p.bundleGroup === "Shringar Kits");
  const singles = all.filter((p) => p.kind === "single");
  const anyTrending = singles.some((p) => p.trending);
  const rank = (slug: string | null) => {
    const i = ESSENTIAL_ORDER.indexOf(slug ?? "");
    return i < 0 ? 99 : i;
  };
  const essentials = [...singles].sort((a, b) => Number(b.trending) - Number(a.trending) || b.score - a.score || Number(b.pinned) - Number(a.pinned) || rank(a.categorySlug) - rank(b.categorySlug)).slice(0, 8);

  // First glance under the hero: bestsellers, offers and new arrivals (boxes and items together).
  const buyable = all.filter((p) => !p.upcoming && p.available !== 0);
  const best = [...buyable].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.score - a.score || Number(b.trending) - Number(a.trending) || Number(!!b.image) - Number(!!a.image)).slice(0, 10);
  const onOffer = deals.products.filter((p) => p.available !== 0).slice(0, 10);
  const fresh = [...all].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
  const bestPct = onOffer.reduce((m, p) => Math.max(m, p.mrp ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0), 0);
  const offerChips = [
    ...deals.offers.map((o) => ({
      kind: "offer" as const,
      text:
        o.type === "free_shipping"
          ? `Free shipping${o.minSubtotal ? ` above ${inr(o.minSubtotal)}` : ""}`
          : `${o.type === "percent" ? `${o.value}%` : inr(o.value)} off${o.minSubtotal ? ` above ${inr(o.minSubtotal)}` : ""}`,
    })),
    ...(bestPct > 0 ? [{ kind: "sale" as const, text: `Up to ${bestPct}% off, ${onOffer.length} on offer` }] : []),
    ...(settings.freeShippingThreshold > 0 ? [{ kind: "shipping" as const, text: `Free shipping above ${inr(settings.freeShippingThreshold)}` }] : []),
  ];
  // Banner: the admin's slides (Admin → Home banner), or automatic ones when none are set up.
  const bp = (p: (typeof all)[number]): BannerProduct => ({ id: p.id, name: p.name, slug: p.slug, image: p.image, price: p.price, mrp: p.mrp, soldOut: p.available === 0, launch: p.upcoming ? launchLabel(p.launchAt) : null });
  const byId = new Map(all.map((p) => [p.id, p]));
  const slideSetup = settings.heroSlides.length ? settings.heroSlides.filter((s) => !s.hidden) : automaticHeroSlides(all, c, content.nav.boxes);
  const bannerSlides: BannerSlide[] = slideSetup.flatMap((s) => {
    // Products hidden or deleted since the slide was set up drop out; a slide that can't be filled is skipped.
    const products = s.productIds.map((id) => byId.get(id)).filter((p) => !!p).map(bp);
    if (products.length < HERO_PRODUCTS[s.kind]) return [];
    return [{
      key: s.id,
      kind: s.kind,
      scene: HERO_SCENE[s.kind],
      label: s.label || undefined,
      title: s.title,
      lede: s.lede || undefined,
      href: s.href,
      action: s.action,
      secondary: s.secondaryLabel && s.secondaryHref ? { href: s.secondaryHref, label: s.secondaryLabel } : undefined,
      products: products.slice(0, HERO_PRODUCTS[s.kind]),
    }];
  });

  // Shop by category: single-item categories, each shown with a product photo from it.
  const catTiles = categories
    .filter((cat) => cat.slug !== "bhakti-boxes-kits")
    .map((cat) => {
      const inCat = singles.filter((p) => p.categorySlug === cat.slug);
      const pic = inCat.find((p) => p.image);
      return { slug: cat.slug, name: cat.name, count: inCat.length, image: pic?.image ?? null, seed: inCat[0]?.id ?? cat.id };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => Number(!!b.image) - Number(!!a.image) || rank(a.slug) - rank(b.slug))
    .slice(0, 8);

  return (
    <div className="home-page">
      {/* Hero: full-width banner carousel. The painting stays still; the slides move over it. */}
      <HeroBanner slides={bannerSlides} />

      <HomePicks best={best} offers={onOffer} fresh={fresh} chips={offerChips} />

      {/* Shop by category: single items, so the store isn't only boxes and sets */}
      {catTiles.length > 1 && (
        <section className="home-cats" aria-labelledby="cats" data-tint="mor">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 id="cats">{c.categoriesTitle}</h2>
              <Link href="/shop?group=items" className="text-ink underline decoration-gold decoration-2 underline-offset-[6px] hover:text-royal">
                {content.nav.items}
              </Link>
            </div>
            <ul style={{ ["--cats" as string]: catTiles.length }} className="no-scrollbar -mx-[var(--gutter)] mt-10 flex snap-x gap-4 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-[repeat(var(--cats),minmax(0,1fr))]">
              {catTiles.map((t) => (
                <li key={t.slug} className="w-[36%] shrink-0 snap-start sm:w-[26%] md:w-auto">
                  <Link href={`/shop?category=${t.slug}`} className="home-cat group block">
                    <span className="home-cat-media">
                      {t.image ? <Media src={t.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <ProductArt name={t.name} seed={t.seed} />}
                    </span>
                    <span className="mt-3 block font-bold text-ink">{t.name}</span>
                    <span className="text-sm text-ink-soft">{t.count} {t.count === 1 ? "item" : "items"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {boxes.length > 0 && <OrnamentDivider kind="lotus" className="home-collection-ornament" />}

      {/* The boxes: with one or two, the heading sits beside them instead of above a mostly empty row */}
      {boxes.length > 0 && (
        <section className="home-boxes" aria-labelledby="boxes" data-tint="gold">
          <Container className={cn(boxes.length <= 2 && "lg:grid lg:grid-cols-12 lg:items-center lg:gap-[var(--gap-columns)]")}>
            <div className={cn("home-section-heading grid items-end gap-6", boxes.length <= 2 ? "lg:col-span-5 lg:block" : "lg:grid-cols-12")}>
              <h2 id="boxes" className={cn(boxes.length > 2 && "lg:col-span-7")}>
                {fmt(c.boxesTitle, { count: boxes.length })}
              </h2>
              <p className={cn("text-ink-soft", boxes.length <= 2 ? "lg:mt-6" : "lg:col-span-4 lg:col-start-9")}>{c.boxesLede}</p>
            </div>
            <div className={cn("home-box-rail no-scrollbar -mx-[var(--gutter)] mt-16 flex snap-x gap-8 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pt-4 pb-2 lg:mx-0 lg:grid lg:overflow-visible lg:px-0", boxes.length <= 2 ? "lg:col-span-7 lg:mt-0 lg:grid-cols-2" : boxes.length === 3 ? "lg:grid-cols-3" : boxes.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-5")}>
              {boxes.map((b, i) => (
                <div key={b.id} className="w-[70%] shrink-0 snap-start sm:w-[42%] lg:w-auto">
                  <BoxCard p={b} priority={i < 2} />
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {essentials.length > 0 && (
        <section className="home-essentials" aria-labelledby="essentials" data-tint="mor">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 id="essentials">{anyTrending ? c.essentialsTrendingTitle : c.essentialsTitle}</h2>
              <Link href="/shop" className="text-ink underline decoration-gold decoration-2 underline-offset-[6px] hover:text-royal">
                {fmt(c.essentialsLink, { count: singles.length })}
              </Link>
            </div>
            <div className="home-essentials-grid mt-16 grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-14 md:grid-cols-3 lg:grid-cols-4">
              {essentials.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Japa sets and shringar kits */}
      {(japa.length > 0 || shringar.length > 0) && <SetSwitcher japa={japa} shringar={shringar} />}

      {/* Shloka band: the brand's line, set as the picture, beside the user's own painting */}
      <section className="home-philosophy on-dark" aria-labelledby="shloka" data-tint="royal">
        <Container className="home-philosophy-grid">
          <div className="home-philosophy-art">
            <div className="arch-frame">
              <div className="arch relative aspect-[4/5] overflow-hidden">
                <Image src={images["home.templeArt"]} data-vv-img="home.templeArt" alt="A temple by a lotus pond, with a peacock and a resting cow and calf" fill sizes="(min-width: 1024px) 420px, 80vw" className="object-cover object-[50%_62%]" />
              </div>
            </div>
          </div>
          <div className="home-philosophy-copy">
            <h2 id="shloka" className="deva" lang="sa">धार्यते इति धर्मः</h2>
            <p className="home-philosophy-translation font-display">{c.shlokaTranslation}</p>
            <p className="home-philosophy-body">{c.shlokaBody}</p>
            <ButtonLink href="/about" variant="outline" className="home-philosophy-action">{c.storyTile}</ButtonLink>
          </div>
        </Container>
      </section>

      {/* Daily essentials */}


      {/* Follow along: the brand's own channels */}
      {(socialUrl("instagram", settings.instagram) || socialUrl("youtube", settings.youtube)) && (
        <section className="home-follow" aria-labelledby="follow" data-tint="gulal">
          <Container>
            <h2 id="follow">{c.followTitle}</h2>
            <div className="home-social-grid">
              {socialUrl("instagram", settings.instagram) && (
                <a href={socialUrl("instagram", settings.instagram)!} target="_blank" rel="noreferrer" className="home-social-link group">
                  <InstagramBadge className="home-social-icon" />
                  <span>
                    <span className="home-social-name font-display">{socialHandle(socialUrl("instagram", settings.instagram))}</span>
                    <span className="home-social-action">{c.followInstagram}</span>
                  </span>
                </a>
              )}
              {socialUrl("instagram", settings.creatorInstagram) && (
                <a href={socialUrl("instagram", settings.creatorInstagram)!} target="_blank" rel="noreferrer" className="home-social-link group">
                  <InstagramBadge className="home-social-icon" />
                  <span>
                    <span className="home-social-name font-display">{socialHandle(socialUrl("instagram", settings.creatorInstagram))}</span>
                    <span className="home-social-action">{c.followCreator}</span>
                  </span>
                </a>
              )}
              {socialUrl("youtube", settings.youtube) && (
                <a href={socialUrl("youtube", settings.youtube)!} target="_blank" rel="noreferrer" className="home-social-link group">
                  <YoutubeBadge className="home-social-icon" />
                  <span>
                    <span className="home-social-name font-display">{c.followYoutubeTitle}</span>
                    <span className="home-social-action">{c.followYoutube}</span>
                  </span>
                </a>
              )}
            </div>
          </Container>
        </section>
      )}
    </div>
  );
}
