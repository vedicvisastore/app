import Image from "next/image";
import { MapPin, PackageCheck, Truck, ArrowUpRight } from "lucide-react";
import "./home.css";
import Link from "next/link";
import { BoxCard, ProductCard } from "@/components/product/cards";
import { QuickAdd } from "@/components/product/quick-add";
import { ButtonLink, Container, Media, Price, ProductArt } from "@/components/ui";
import { socialUrl } from "@/lib/settings-defaults";
import { inr, launchLabel } from "@/lib/utils";
import { api } from "@/server/caller";
import { fmt } from "@/content/defaults";
import { getSite } from "@/server/site-config";
import { InstagramBadge, YoutubeBadge } from "@/components/site/social";
import { SetSwitcher } from "./set-switcher";
import { FestiveHanging } from "@/components/site/festive-hanging";

const ESSENTIAL_ORDER = ["jap-mala", "kanthi-mala", "japa-bags", "tilak-chandan", "itra-fragrance", "japa-accessories", "books"];

export default async function Home() {
  const trpc = await api();
  const [all, settings, { content }] = await Promise.all([trpc.catalog.list({}), trpc.catalog.settings(), getSite()]);
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
  const essentials = (anyTrending ? singles : [...singles].sort((a, b) => Number(b.pinned) - Number(a.pinned) || rank(a.categorySlug) - rank(b.categorySlug))).slice(0, 8);
  const heroBox = boxes.find((b) => b.image) ?? boxes[0];
  const inside = heroBox ? await trpc.catalog.spotlight({ slug: heroBox.slug }) : null;

  return (
    <div className="home-page">
      {/* Hero: a bento of the offer, the box, the painting and the sets */}
      <section className="home-hero relative" aria-label="VedicVisa">
        <FestiveHanging />
        <Container>
          <div className="home-bento">
            <div className="home-intro on-dark">
              <span className="home-door arch" aria-hidden />
              <div className="home-intro-content">
                <h1>{c.heroTitle}</h1>
                <p className="home-lead">{c.heroLede}</p>
                <div className="home-actions">
                  <ButtonLink href="/shop?group=bhakti-boxes" size="lg">{c.heroPrimary}</ButtonLink>
                  <ButtonLink href="/shop" size="lg" variant="outline" className="text-white">{c.heroSecondary}</ButtonLink>
                </div>
              </div>
              <div className="home-signature">
                <span className="home-signature-rule" aria-hidden />
                <p className="deva" lang="sa">धार्यते इति धर्मः</p>
              </div>
            </div>

            {heroBox && (
              <div className="home-featured">
                <Link href={`/p/${heroBox.slug}`} className="home-featured-image" aria-label={`Explore ${heroBox.name}`}>
                  {heroBox.image ? (
                    <Media src={heroBox.image} alt={heroBox.name} priority className="h-full w-full object-cover" />
                  ) : (
                    <ProductArt name={heroBox.name} seed={heroBox.id} />
                  )}
                </Link>
                <div className="home-featured-caption">
                  <div className="min-w-0">
                    <Link href={`/p/${heroBox.slug}`} className="home-featured-name">{heroBox.name}</Link>
                    <Price price={heroBox.price} mrp={heroBox.mrp} size="sm" />
                  </div>
                  {heroBox.upcoming ? <span className="text-sm font-bold text-gold-ink">{launchLabel(heroBox.launchAt)}</span> : <QuickAdd productId={heroBox.id} name={heroBox.name} disabled={heroBox.available === 0} />}
                </div>
              </div>
            )}

            <div className="home-discover">
              <Link href="/about" className="home-story-link group">
                <Image src="/brand/hero-temple.jpg" alt="A temple by a lotus pond with a peacock" fill sizes="(min-width: 1440px) 280px, (min-width: 1024px) 22vw, 50vw" className="object-cover object-[80%_62%]" />
                <span className="home-story-caption"><span>{c.storyTile}</span><ArrowUpRight aria-hidden size={20} /></span>
              </Link>
              {japa[0] && (
                <Link href="/shop?group=japa-sets" className="home-japa">
                  <span className="deva home-japa-word" aria-hidden lang="sa">जप</span>
                  <span className="home-japa-title">{fmt(c.japaTile, { price: inr(Math.min(...japa.map((j) => j.price))) })}</span>
                  <span className="home-japa-action"><span>{c.japaTileLink}</span><ArrowUpRight aria-hidden size={20} /></span>
                </Link>
              )}
            </div>
          </div>
          <ul className="home-delivery" aria-label="Delivery information">
            <li><MapPin aria-hidden /><span>{c.chipShipping}</span></li>
            <li><PackageCheck aria-hidden /><span>{fmt(c.chipDelivery, { min: settings.deliveryDaysMin, max: settings.deliveryDaysMax })}</span></li>
            {settings.freeShippingThreshold > 0 && <li><Truck aria-hidden /><span>{fmt(c.chipFree, { threshold: inr(settings.freeShippingThreshold) })}</span></li>}
          </ul>
        </Container>
      </section>

      {/* The boxes */}
      {boxes.length > 0 && (
        <section className="home-boxes" aria-labelledby="boxes">
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

      {/* What's inside: the box's own contents, as an index */}
      {inside && inside.components.length > 0 && (
        <section id="inside" className="home-inside" aria-labelledby="inside-h">
          <Container className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id="inside-h">{fmt(c.insideTitle, { name: inside.name.replace(/ Bhakti Box$/, "") })}</h2>
              {inside.worth > inside.price && (
                <p className="mt-6 text-lg text-ink-soft">{fmt(c.insideWorth, { worth: inr(inside.worth), price: inr(inside.price) })}</p>
              )}
              <ButtonLink href={`/p/${inside.slug}`} className="mt-8" variant="outline">
                {c.insideCta}
              </ButtonLink>
            </div>
            <ol className="grid content-start gap-x-10 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
              {inside.components.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3.5">
                  <Link href={`/p/${c.slug}`} className="text-[1.05rem] hover:text-royal">
                    {c.qty > 1 && `${c.qty} × `}
                    {c.name}
                  </Link>
                  <span className="text-sm text-ink-soft tabular-nums">{inr(c.price * c.qty)}</span>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      )}

      {/* Shloka band: the brand's line, set as the picture, beside the user's own painting */}
      <section className="home-philosophy on-dark" aria-labelledby="shloka">
        <Container className="home-philosophy-grid grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="shloka" className="deva max-w-none text-[clamp(3.5rem,8vw,7.5rem)] leading-[1.1] text-gold" lang="sa">
              धार्यते इति धर्मः
            </h2>
            <p className="font-display mt-8 max-w-[24ch] text-[length:var(--text-display-s)] leading-[1.1] text-on-shyam">{c.shlokaTranslation}</p>
            <p className="mt-6 max-w-[48ch] text-on-shyam-2">{c.shlokaBody}</p>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <div className="arch-frame mx-auto max-w-[360px]">
              <div className="arch relative aspect-[4/5] overflow-hidden">
                <Image src="/brand/hero-temple.jpg" alt="A temple by a lotus pond, with a peacock and a resting cow and calf" fill sizes="360px" className="object-cover object-[50%_62%]" />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Daily essentials */}
      {essentials.length > 0 && (
        <section className="home-essentials" aria-labelledby="essentials">
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

      {/* Follow along: the brand's own channels */}
      {(socialUrl("instagram", settings.instagram) || socialUrl("youtube", settings.youtube)) && (
        <section className="home-follow" aria-labelledby="follow">
          <Container>
            <h2 id="follow">{c.followTitle}</h2>
            <div className="home-social-grid">
              {socialUrl("instagram", settings.instagram) && (
                <a href={socialUrl("instagram", settings.instagram)!} target="_blank" rel="noreferrer" className="home-social-link group">
                  <InstagramBadge className="home-social-icon" />
                  <span className="deva home-social-word" aria-hidden lang="sa">दर्शन</span>
                  <span>
                    <span className="home-social-name font-display">@vedicvisa</span>
                    <span className="home-social-action">{c.followInstagram}</span>
                  </span>
                </a>
              )}
              {socialUrl("youtube", settings.youtube) && (
                <a href={socialUrl("youtube", settings.youtube)!} target="_blank" rel="noreferrer" className="home-social-link group">
                  <YoutubeBadge className="home-social-icon" />
                  <span className="deva home-social-word" aria-hidden lang="sa">कथा</span>
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
