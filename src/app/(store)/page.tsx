import { OrnamentDivider } from "@/components/site/ornament";
import Image from "next/image";
import "./home.css";
import Link from "next/link";
import { BoxCard, ProductCard } from "@/components/product/cards";
import { ButtonLink, Container } from "@/components/ui";
import { socialHandle, socialUrl } from "@/lib/settings-defaults";
import { inr, launchLabel } from "@/lib/utils";
import { api } from "@/server/caller";
import { fmt } from "@/content/defaults";
import { getSite } from "@/server/site-config";
import { InstagramBadge, YoutubeBadge } from "@/components/site/social";
import { SetSwitcher } from "./set-switcher";
import { HeroBanner, type BannerProduct, type BannerSlide } from "./hero-banner";
import { HomePicks } from "./home-picks";

const ESSENTIAL_ORDER = ["jap-mala", "kanthi-mala", "japa-bags", "tilak-chandan", "itra-fragrance", "japa-accessories", "books"];

export default async function Home() {
  const trpc = await api();
  const [all, settings, { content }, deals] = await Promise.all([trpc.catalog.list({}), trpc.catalog.settings(), getSite(), trpc.catalog.deals()]);
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
  const heroBox = boxes.find((b) => b.image) ?? boxes[0];

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
  // Banner: brand → signature box → japa trio → shringar trio (trios need three products; bestsellers fill a gap).
  const bp = (p: (typeof all)[number]): BannerProduct => ({ id: p.id, name: p.name, slug: p.slug, image: p.image, price: p.price, mrp: p.mrp, soldOut: p.available === 0, launch: p.upcoming ? launchLabel(p.launchAt) : null });
  const photoFirst = (list: typeof all) => [...list].sort((a, b) => Number(!!b.image) - Number(!!a.image) || Number(b.pinned) - Number(a.pinned) || b.score - a.score);
  const signature = boxes.find((b) => b.featured && b.image) ?? heroBox;
  const trio = (list: typeof all) => photoFirst(list).slice(0, 3);
  const bannerSlides: BannerSlide[] = [
    { key: "brand", kind: "brand", scene: "/brand/hero-banner.webp", title: c.heroEverydayTitle, lede: c.heroEverydayLede, href: "/shop", action: c.heroEverydayAction, secondary: { href: "/about", label: c.storyTile }, products: [] },
    ...(signature ? [{ key: "box", kind: "feature" as const, scene: "/brand/hero-banner-single.webp", label: content.nav.boxes, title: c.heroTitle, lede: c.heroLede, href: "/shop?group=bhakti-boxes", action: c.heroPrimary, products: [bp(signature)] }] : []),
    ...(japa.length >= 3 ? [{ key: "japa", kind: "trio" as const, scene: "/brand/hero-banner-trio.webp", label: c.setsJapaTab, title: c.heroJapaTitle, href: "/shop?group=japa-sets", action: c.japaTileLink, products: trio(japa).map(bp) }] : []),
    ...(shringar.length >= 3 ? [{ key: "shringar", kind: "trio" as const, scene: "/brand/hero-banner-trio.webp", label: c.setsShringarTab, title: c.heroShringarTitle, href: "/shop?group=shringar-kits", action: c.heroShringarAction, products: trio(shringar).map(bp) }] : []),
    ...(japa.length < 3 || shringar.length < 3 ? [{ key: "best", kind: "trio" as const, scene: "/brand/hero-banner-trio.webp", label: c.picksBest, title: c.heroEverydayTitle, href: "/shop", action: c.heroSecondary, products: trio(buyable).map(bp) }].filter((s) => s.products.length === 3) : []),
  ];

  return (
    <div className="home-page">
      {/* Hero: full-width banner carousel. The painting stays still; the slides move over it. */}
      <HeroBanner slides={bannerSlides} />

      <HomePicks best={best} offers={onOffer} fresh={fresh} chips={offerChips} />

      {boxes.length > 0 && <OrnamentDivider kind="lotus" className="home-collection-ornament" />}

      {/* The boxes */}
      {boxes.length > 0 && (
        <section className="home-boxes" aria-labelledby="boxes" data-tint="gold">
          <Container>
            <div className="home-section-heading grid items-end gap-6 lg:grid-cols-12">
              <h2 id="boxes" className="lg:col-span-7">
                {fmt(c.boxesTitle, { count: boxes.length })}
              </h2>
              <p className="text-ink-soft lg:col-span-4 lg:col-start-9">{c.boxesLede}</p>
            </div>
            <div className="home-box-rail no-scrollbar -mx-[var(--gutter)] mt-16 flex snap-x gap-8 overflow-x-auto px-[var(--gutter)] pt-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
              {boxes.map((b, i) => (
                <div key={b.id} className="w-[70%] shrink-0 snap-start sm:w-[42%] lg:w-auto">
                  <BoxCard p={b} priority={i < 2} />
                </div>
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
                <Image src="/brand/hero-temple.jpg" alt="A temple by a lotus pond, with a peacock and a resting cow and calf" fill sizes="(min-width: 1024px) 420px, 80vw" className="object-cover object-[50%_62%]" />
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
