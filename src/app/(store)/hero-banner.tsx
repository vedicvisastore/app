"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { QuickAdd } from "@/components/product/quick-add";
import { useContent, useImages } from "@/components/site/content-context";
import { ButtonLink, Media, Price, ProductArt } from "@/components/ui";
import { isVideo } from "@/lib/utils";
import "./hero-banner.css";

export type BannerProduct = { id: number; name: string; slug: string; image: string | null; price: number; mrp: number | null; soldOut: boolean; launch: string | null };
export type BannerSlide = {
  key: string;
  /** brand: logo + line. feature: one product on the long plinth. trio: three products on three plinths. */
  kind: "brand" | "feature" | "trio";
  /** Painted scene behind this slide; scenes share one composition so they cross-fade instead of sliding. */
  scene: string;
  label?: string;
  title: string;
  lede?: string;
  href: string;
  action: string;
  secondary?: { href: string; label: string };
  products: BannerProduct[];
};

const AUTO_MS = 7000;
const SLIDE_MS = 750;
/** Plinth centres in the trio painting, as % of its width. */
const TRIO_X = [27.5, 50, 72.6];

/**
 * Full-width banner carousel over painted scenes of one temple lake. The painting never slides: when the next slide
 * needs a different scene (plinths for products, open sky for the brand) it cross-fades in place, while the copy and
 * products slide across. On desktop everything sits on a 16:9 "stage" with the same geometry as the painting, so
 * products stand exactly on its stone plinths. Loops one way (a clone at each end). Auto-advance stops on hover, focus,
 * offscreen, hidden tab and reduced motion. No pause button (owner's call).
 */
export function HeroBanner({ slides }: { slides: BannerSlide[] }) {
  const c = useContent().home;
  const count = slides.length;
  const looped = count > 1;
  const root = useRef<HTMLElement>(null);
  const moving = useRef(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const [pos, setPos] = useState(looped ? 1 : 0);
  const [animate, setAnimate] = useState(true);
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [reduced, setReduced] = useState(true);
  const [warm, setWarm] = useState(false); // other scenes load after the first paint, not with it
  const index = looped ? (pos - 1 + count) % count : 0;
  const scenes = [...new Set(slides.map((s) => s.scene))];

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(motion.matches);
    const seen = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting && !document.hidden), { threshold: 0.3 });
    const vis = () => setOnScreen(!document.hidden);
    // Phones show only the first scene (see hero-banner.css), so the others load only on wide screens.
    const wide = window.matchMedia("(min-width: 900px)");
    const widen = () => wide.matches && setWarm(true);
    sync();
    const w = window.setTimeout(widen, 1200);
    seen.observe(root.current!);
    motion.addEventListener("change", sync);
    wide.addEventListener("change", widen);
    document.addEventListener("visibilitychange", vis);
    return () => {
      seen.disconnect();
      window.clearTimeout(w);
      motion.removeEventListener("change", sync);
      wide.removeEventListener("change", widen);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  useEffect(() => {
    if (animate) return;
    const f = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(f);
  }, [animate]);

  const settle = useCallback(() => {
    moving.current = false;
    setPos((p) => {
      if (p === count + 1) return setAnimate(false), 1;
      if (p === 0) return setAnimate(false), count;
      return p;
    });
  }, [count]);

  const goTo = useCallback(
    (next: number) => {
      if (!looped || moving.current) return;
      if (reduced) {
        setAnimate(false);
        setPos(((next - 1 + count) % count) + 1);
        return;
      }
      moving.current = true;
      setAnimate(true);
      setPos(next);
      window.setTimeout(() => moving.current && settle(), SLIDE_MS + 200);
    },
    [looped, reduced, count, settle],
  );

  useEffect(() => {
    if (!looped || held || !onScreen || reduced) return;
    // Not while the owner is editing text in the visual editor (the slide would move away mid-edit).
    const t = window.setTimeout(() => !document.documentElement.classList.contains("vv-editing") && goTo(pos + 1), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [looped, held, onScreen, reduced, pos, goTo]);

  const items = looped ? [{ s: slides[count - 1], real: count - 1, clone: true }, ...slides.map((s, i) => ({ s, real: i, clone: false })), { s: slides[0], real: 0, clone: true }] : slides.map((s, i) => ({ s, real: i, clone: false }));

  return (
    <section
      ref={root}
      className="hb"
      data-tint="peacock"
      data-vv-section="/admin/hero"
      data-vv-label="Edit banner"
      aria-roledescription="carousel"
      aria-label={c.heroSliderLabel}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld(false)}
    >
      <div className="hb-scenes" aria-hidden>
        {scenes.map((src, i) => (
          <div key={src} className="hb-stage hb-scene" data-active={src === slides[index].scene || undefined}>
            {(i === 0 || warm) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" fetchPriority={i === 0 ? "high" : "low"} />
            )}
          </div>
        ))}
      </div>

      <div
        className="hb-viewport"
        onPointerDown={(e) => {
          swiped.current = false;
          pointer.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 1.5) {
            swiped.current = true;
            goTo(pos + (dx < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => (pointer.current = null)}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        <div
          className="hb-track"
          style={{ transform: `translate3d(${-pos * 100}%,0,0)`, transition: animate && !reduced ? `transform ${SLIDE_MS}ms cubic-bezier(.65,0,.35,1)` : "none" }}
          onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === "transform" && settle()}
        >
          {items.map(({ s, real, clone }, i) => (
            <div
              key={`${s.key}-${i}`}
              className="hb-slide"
              data-kind={s.kind}
              data-active={real === index || undefined}
              role={clone ? undefined : "group"}
              aria-roledescription={clone ? undefined : "slide"}
              aria-label={clone ? undefined : `${real + 1} / ${count}: ${s.label ?? s.title}`}
              aria-hidden={clone || real !== index}
              inert={clone || real !== index}
            >
              <div className="hb-stage">
                <SlideBody s={s} heading={clone ? "p" : real === 0 ? "h1" : "h2"} eager={real === 0 && !clone} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {looped && (
        <>
          <button type="button" className="hb-arrow hb-prev" onClick={() => goTo(pos - 1)} aria-label={c.heroSliderPrevious}>
            <ChevronLeft aria-hidden className="size-6" />
          </button>
          <button type="button" className="hb-arrow hb-next" onClick={() => goTo(pos + 1)} aria-label={c.heroSliderNext}>
            <ChevronRight aria-hidden className="size-6" />
          </button>
          <div className="hb-dots">
            {slides.map((s, i) => (
              <button key={s.key} type="button" aria-label={s.label ?? s.title} aria-current={i === index || undefined} onClick={() => goTo(i + 1)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SlideBody({ s, heading: H, eager }: { s: BannerSlide; heading: "h1" | "h2" | "p"; eager: boolean }) {
  const logo = useImages()["brand.logo"];
  const actions = (
    <div className="hb-actions">
      <ButtonLink href={s.href} size="lg">
        {s.action}
      </ButtonLink>
      {s.secondary && (
        <Link href={s.secondary.href} className="hb-secondary">
          {s.secondary.label}
        </Link>
      )}
    </div>
  );

  if (s.kind === "brand")
    return (
      <div className="hb-brand hb-rise">
        <Image src={logo} data-vv-img="brand.logo" alt="VedicVisa" width={900} height={591} priority={eager} className="hb-logo" />
        <H className="hb-title">{s.title}</H>
        {s.lede && <p className="hb-lede">{s.lede}</p>}
        {actions}
      </div>
    );

  if (s.kind === "feature") {
    const p = s.products[0];
    return (
      <>
        <div className="hb-copy hb-rise">
          {s.label && <p className="hb-label">{s.label}</p>}
          <H className="hb-title">{s.title}</H>
          {s.lede && <p className="hb-lede">{s.lede}</p>}
          <div className="hb-feature-line">
            <span className="min-w-0">
              <Link href={`/p/${p.slug}`} className="hb-name">
                {p.name}
              </Link>
              <Price price={p.price} mrp={p.mrp} size="sm" />
            </span>
            {p.launch ? <span className="text-sm font-bold text-gold-ink">{p.launch}</span> : <QuickAdd productId={p.id} name={p.name} disabled={p.soldOut} />}
          </div>
          {actions}
        </div>
        <div className="hb-item hb-item-feature hb-rise">
          <Photo p={p} eager={eager} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hb-heading hb-rise">
        {s.label && <p className="hb-label">{s.label}</p>}
        <H className="hb-title">{s.title}</H>
        {actions}
      </div>
      <ul className="hb-items">
        {s.products.slice(0, 3).map((p, i) => (
          <li key={p.id} className="hb-item hb-rise" style={{ left: `${TRIO_X[i]}%`, transitionDelay: `${0.25 + i * 0.08}s` }}>
            <Photo p={p} eager={eager} />
            <div className="hb-tag">
              <Link href={`/p/${p.slug}`} className="hb-name">
                {p.name}
              </Link>
              <Price price={p.price} mrp={p.mrp} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Photo({ p, eager }: { p: BannerProduct; eager: boolean }) {
  return (
    <Link href={`/p/${p.slug}`} className="hb-photo" aria-label={p.name}>
      {!p.image ? (
        <ProductArt name={p.name} seed={p.id} />
      ) : isVideo(p.image) ? (
        <Media src={p.image} alt={p.name} className="h-full w-full object-cover" />
      ) : (
        // Not lazy: slides start off-screen and lazy images would pop in mid-slide. Only the first is high priority.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt={p.name} loading="eager" fetchPriority={eager ? "high" : "low"} className="h-full w-full object-cover" />
      )}
    </Link>
  );
}
