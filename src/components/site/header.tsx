"use client";
import { BadgePercent, CalendarHeart, ChevronDown, ChevronRight, Info, Menu, MessageCircle, Package, RotateCcw, Search, ShoppingBag, Sparkles, Truck, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RibbonItem } from "@/lib/settings-defaults";
import type { ShopLink } from "@/lib/shop-links";
import { cn } from "@/lib/utils";
import { useCart } from "../cart/cart-context";
import { useContent, useImages } from "./content-context";

export type MenuFestival = { name: string; slug: string; accent: string };
export type MenuCategory = { name: string; slug: string };

const DOT: Record<string, string> = { gulal: "bg-gulal", gold: "bg-gold", royal: "bg-royal", peacock: "bg-peacock", mor: "bg-mor" };

type Props = {
  ribbon: RibbonItem[];
  ribbonSeconds: number;
  signedIn: boolean;
  isAdmin: boolean;
  categories: MenuCategory[];
  /** Live box/set groups and single items (see shopLinks): only what the store actually sells. */
  sets: ShopLink[];
  festivals: MenuFestival[];
};

export function Header({ ribbon, ribbonSeconds, signedIn, isAdmin, categories, sets, festivals }: Props) {
  const copy = useContent().nav;
  const logo = useImages()["brand.logo"];
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [bump, setBump] = useState(false);

  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [pathname]);
  useEffect(() => {
    if (!cart.count) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 700);
    return () => clearTimeout(t);
  }, [cart.count]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => void (document.body.style.overflow = "");
  }, [menu]);

  const cats = categories.filter((c) => c.slug !== "bhakti-boxes-kits");
  const links = [
    { href: "/new", label: copy.newLaunches },
    { href: "/deals", label: copy.deals, dot: "bg-gulal" },
    ...festivals.map((f) => ({ href: `/c/${f.slug}`, label: f.name, dot: DOT[f.accent] ?? "bg-gulal" })),
  ];
  // Top-level menu: boxes and single items get their own links; any other sets go under "Kits & sets".
  const boxes = sets.find((s) => s.slug === "bhakti-boxes");
  const items = sets.find((s) => s.slug === "items");
  const kits = sets.filter((s) => s !== boxes && s !== items);
  const help = [
    { href: "/track", label: copy.track },
    { href: signedIn ? "/account" : "/login?next=/account", label: copy.orders },
    { href: "/contact", label: copy.contact },
    { href: "/shipping", label: copy.shipping },
  ];
  const navLink = (active: boolean) => cn("vv-menu-item flex items-center gap-2 py-3 text-[1.0625rem] font-medium whitespace-nowrap transition-colors hover:text-gold", active ? "font-bold text-gold" : "text-white");
  const isActive = (href: string) => pathname === href.split("?")[0];

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setSearch(false);
    setMenu(false);
    router.push(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
  };

  const iconBtn = "grid size-10 place-items-center rounded-full transition-colors hover:bg-sky";

  return (
    <>
      {ribbon.length > 0 && (
        <div className="marquee-wrap overflow-hidden bg-royal text-white" aria-label="Store announcements" data-vv-section="/admin/ribbon" data-vv-label="Edit ribbon" data-s="ribbon">
          <div className="marquee py-2 text-[0.8125rem]" style={{ animationDuration: `${ribbonSeconds}s` }}>
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0" aria-hidden={k === 1}>
                {Array.from({ length: Math.max(2, Math.ceil(8 / ribbon.length)) }).flatMap((_, i) =>
                  ribbon.map((r, j) => (
                    <span key={`${i}-${j}`} className="flex items-center gap-6 pr-6 whitespace-nowrap">
                      {r.href ? (
                        <Link href={r.href} tabIndex={k === 1 ? -1 : undefined} className="underline decoration-white/40 underline-offset-4 hover:decoration-white">
                          {r.text}
                        </Link>
                      ) : (
                        r.text
                      )}
                      <svg viewBox="0 0 10 10" className="vv-twinkle size-2 fill-gold" aria-hidden style={{ animationDelay: `${(j % 4) * 0.6}s` }}>
                        <path d="M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z" />
                      </svg>
                    </span>
                  )),
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <header className="vv-header sticky top-0 z-[300] border-b border-line bg-paper lg:border-b-0" data-s="header">
        {/* Top row: search · logo (centre) · account and cart */}
        <div className="wrap grid h-[84px] grid-cols-[1fr_auto_1fr] items-center gap-3 sm:h-[92px] lg:h-[120px]">
          <div className="flex items-center gap-1">
            <button className={cn(iconBtn, "-ml-2 lg:hidden")} onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
              <Menu className="size-5" />
            </button>
            <button className={cn(iconBtn, "lg:hidden")} onClick={() => setSearch((s) => !s)} aria-label="Search" aria-expanded={search}>
              <Search className="size-5" />
            </button>
            <form onSubmit={submitSearch} className="hidden w-full max-w-[19rem] lg:block" role="search">
              <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-paper-2 px-4 transition-colors focus-within:border-royal hover:border-line-strong">
                <Search className="size-4 shrink-0 text-ink-mute" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.searchPlaceholder} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-mute" aria-label="Search products" />
              </label>
            </form>
          </div>

          <Link href="/" className="justify-self-center" aria-label="VedicVisa home">
            <Image src={logo} data-vv-img="brand.logo" alt="VedicVisa" width={900} height={591} priority className="h-[66px] w-auto sm:h-[74px] lg:h-[100px]" />
          </Link>

          <div className="flex items-center justify-end gap-1">
            {isAdmin && (
              <Link href="/admin" className="mr-1 hidden rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:text-ink md:block">
                Admin
              </Link>
            )}
            <Link href={signedIn ? "/account" : "/login"} className={iconBtn} aria-label={signedIn ? "Your account" : "Log in"}>
              <User className="size-5" />
            </Link>
            <button onClick={() => cart.setOpen(true)} className={cn(iconBtn, "relative -mr-2")} aria-label={`Cart, ${cart.count} items`}>
              <ShoppingBag className="size-5" />
              {bump && (
                <span className="vv-burst pointer-events-none absolute inset-0" aria-hidden>
                  {[0, 60, 120, 180, 240, 300].map((r, i) => (
                    <span key={r} style={{ ["--r" as string]: `${r}deg`, background: i % 2 ? "var(--color-gulal)" : "var(--color-gold)" }} />
                  ))}
                </span>
              )}
              {cart.count > 0 && (
                <span className={cn("absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-shyam transition-transform duration-[var(--dur-short)]", bump && "scale-125")}>
                  {cart.count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Second row (desktop): the menu */}
        <nav className="vv-menu hidden bg-shyam lg:block" aria-label="Main" data-s="menu">
          <ul className="wrap flex h-14 items-center justify-center gap-6 xl:gap-9">
            <li>
              <Dropdown label={copy.shop} active={pathname === "/shop"} pathname={pathname} wide>
                <div className="grid grid-cols-[1fr_1.6fr] gap-6">
                  <div>
                    <p className="mb-3 text-xs font-bold tracking-[0.08em] text-ink-mute uppercase">{copy.byType}</p>
                    <ul className="space-y-1">
                      {sets.map((s) => (
                        <li key={s.href}>
                          <Link href={s.href} className="font-display block py-1 text-xl text-ink hover:text-ink">
                            {s.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href="/shop" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-royal">
                      {copy.shopAll} <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-bold tracking-[0.08em] text-ink-mute uppercase">{copy.byCategory}</p>
                    <ul className={cn("gap-x-6", cats.length > 9 ? "columns-2" : "")} data-vv-section="/admin/menu" data-vv-label="Edit menu">
                      {cats.map((c) => (
                        <li key={c.slug}>
                          <Link href={`/shop?category=${c.slug}`} className="block py-1 text-[0.95rem] text-ink-soft hover:text-ink">
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Dropdown>
            </li>
            {[boxes, items].filter((s) => !!s).map((s) => (
              <li key={s.slug}>
                <Link href={s.href} className={navLink(false)}>
                  {s.label}
                </Link>
              </li>
            ))}
            {kits.length > 0 && (
            <li>
              <Dropdown label={copy.kits} active={false} pathname={pathname}>
                <ul className="space-y-1">
                  {kits.map((s) => (
                    <li key={s.href}>
                      <Link href={s.href} className="font-display block py-1 text-xl whitespace-nowrap text-ink hover:text-ink">
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Dropdown>
            </li>
            )}
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={navLink(isActive(l.href))}>
                  {"dot" in l && l.dot && <span className={cn("size-1.5 rounded-full", l.dot)} aria-hidden />}
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/about" aria-current={isActive("/about") ? "page" : undefined} className={navLink(isActive("/about"))}>
                {copy.about}
              </Link>
            </li>
            <li>
              <Dropdown label={copy.help} active={["/track", "/contact", "/shipping"].includes(pathname)} pathname={pathname} alignRight>
                <ul className="space-y-0.5">
                  {help.map((h) => (
                    <li key={h.href}>
                      <Link href={h.href} className="block rounded-lg px-2 py-1.5 text-[0.95rem] whitespace-nowrap text-ink-soft hover:bg-sky/60 hover:text-ink">
                        {h.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Dropdown>
            </li>
          </ul>
        </nav>

        {search && (
          <form className="border-t border-line bg-paper lg:hidden" onSubmit={submitSearch} role="search">
            <div className="wrap flex items-center gap-3 py-3">
              <Search className="size-5 text-ink-mute" aria-hidden />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.searchPlaceholder} className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-mute" aria-label="Search products" />
              <button type="button" onClick={() => setSearch(false)} className={iconBtn} aria-label="Close search">
                <X className="size-5" />
              </button>
            </div>
          </form>
        )}
      </header>

      {/* Mobile menu: colourful set tiles, quick links, category chips, help with icons */}
      <div className={cn("fixed inset-0 z-[400] overflow-hidden lg:hidden", !menu && "pointer-events-none invisible")} aria-hidden={!menu}>
        <div className={cn("absolute inset-0 bg-shyam/45 backdrop-blur-[2px] transition-opacity", menu ? "opacity-100" : "opacity-0")} onClick={() => setMenu(false)} />
        <nav
          className={cn(
            "vv-drawer absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-paper pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-float transition-transform duration-[var(--dur-long)] ease-[var(--ease-out)]",
            menu ? "translate-x-0" : "-translate-x-full",
          )}
          data-open={menu || undefined}
          aria-label="Mobile"
        >
          {/* Top: logo, close, search, on a soft gradient with the brand edge */}
          <div className="vv-drawer-top relative px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-4">
            <div className="mb-3 flex items-center justify-between">
              <Image src={logo} data-vv-img="brand.logo" alt="VedicVisa" width={900} height={591} className="h-12 w-auto" />
              <button onClick={() => setMenu(false)} className="grid size-10 place-items-center rounded-full bg-paper/80 shadow-lift" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={submitSearch} role="search">
              <label className="flex h-12 items-center gap-2 rounded-full border border-line bg-paper px-4 shadow-lift focus-within:border-royal">
                <Search className="size-4 text-royal" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.searchPlaceholder} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-mute" aria-label="Search products" />
              </label>
            </form>
          </div>

          <div className="space-y-6 px-4 pt-5">
            {/* Sets and single items as bold colour tiles */}
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <p className="vv-drawer-kicker">{copy.byType}</p>
                <Link href="/shop" className="inline-flex items-center gap-0.5 text-sm font-bold text-royal">
                  {copy.shopAll} <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-2.5">
                {sets.map((s, i) => {
                  const t = TILE[i % TILE.length];
                  return (
                    <li key={s.href} className="vv-drawer-item" style={{ ["--i" as string]: i }}>
                      <Link href={s.href} className={cn("relative flex h-24 flex-col justify-end overflow-hidden rounded-2xl p-3 transition-transform active:scale-[0.97]", t)}>
                        <span className="deva pointer-events-none absolute -top-2 -right-1 text-[3.4rem] leading-none opacity-20" lang="sa" aria-hidden>
                          {SET_WORD[s.slug] ?? "॥"}
                        </span>
                        <span className="relative font-display text-[1.15rem] leading-tight">{s.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* New, deals and live custom pages as quick pills */}
            <section className="vv-drawer-item flex flex-wrap gap-2" style={{ ["--i" as string]: sets.length }}>
              {links.map((l) => {
                const Icon = l.href === "/new" ? Sparkles : l.href === "/deals" ? BadgePercent : CalendarHeart;
                return (
                  <Link key={l.href} href={l.href} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-bold", l.href === "/deals" ? "border-gulal/30 bg-gulal-soft text-gulal" : "border-line bg-paper-2 text-ink")}>
                    <Icon className="size-4" aria-hidden />
                    {l.label}
                  </Link>
                );
              })}
            </section>

            {cats.length > 0 && (
              <section className="vv-drawer-item" style={{ ["--i" as string]: sets.length + 1 }}>
                <p className="vv-drawer-kicker mb-2.5">{copy.byCategory}</p>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1.5">
                  {cats.map((c, i) => (
                    <Link key={c.slug} href={`/shop?category=${c.slug}`} className={cn("shrink-0 rounded-full border-2 bg-paper px-3.5 py-2 text-sm font-bold whitespace-nowrap text-ink", CHIP[i % CHIP.length])}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="vv-drawer-item" style={{ ["--i" as string]: sets.length + 2 }}>
              <p className="vv-drawer-kicker mb-1.5">{copy.help}</p>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-2/60">
                {[...help, { href: "/about", label: copy.about }].map((h) => {
                  const Icon = HELP_ICON[h.href.split("?")[0]] ?? Info;
                  return (
                    <li key={h.href}>
                      <Link href={h.href} className="flex items-center gap-3 px-3.5 py-3 text-[0.98rem] text-ink active:bg-sky">
                        <span className="grid size-8 place-items-center rounded-full bg-paper text-royal shadow-lift">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="flex-1">{h.label}</span>
                        <ChevronRight className="size-4 text-ink-mute" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="vv-drawer-item flex flex-col gap-2" style={{ ["--i" as string]: sets.length + 3 }}>
              <Link href={signedIn ? "/account" : "/login"} className="flex h-12 items-center justify-center gap-2 rounded-full bg-gold font-bold text-shyam shadow-lift">
                <User className="size-4" aria-hidden /> {signedIn ? "Your Account and Orders" : "Log In"}
              </Link>
              {isAdmin && (
                <Link href="/admin" className="flex h-11 items-center justify-center rounded-full border border-line font-bold text-gold-ink">
                  Admin Panel
                </Link>
              )}
            </div>
          </div>

          <p className="deva mt-auto px-4 pt-8 text-center text-2xl text-gulal" lang="sa">
            धार्यते इति धर्मः
          </p>
        </nav>
      </div>
    </>
  );
}

/** Phone menu tiles cycle through the brand colours; each set gets its Sanskrit word as a watermark. */
const TILE = ["bg-royal text-white", "bg-peacock text-white", "bg-gulal text-white", "bg-mor text-white", "bg-gold text-shyam"];
const CHIP = ["border-royal/25", "border-peacock/30", "border-gulal/30", "border-gold/50", "border-mor/30"];
const SET_WORD: Record<string, string> = { "bhakti-boxes": "भक्ति", items: "माला", "japa-sets": "जप", "shringar-kits": "श्रृंगार" };
const HELP_ICON: Record<string, typeof Truck> = { "/track": Truck, "/account": Package, "/login": Package, "/contact": MessageCircle, "/shipping": RotateCcw, "/about": Info };

/** Desktop menu item with a panel: opens on hover or click, closes on leave, Escape, outside click or navigation. */
function Dropdown({ label, active, pathname, wide, alignRight, children }: { label: string; active: boolean; pathname: string; wide?: boolean; alignRight?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className={cn("vv-menu-item flex items-center gap-1 py-3 text-[1.0625rem] font-medium whitespace-nowrap transition-colors hover:text-gold", active ? "font-bold text-gold" : "text-white")}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown className={cn("size-4 transition-transform duration-[var(--dur-short)]", open && "rotate-180")} aria-hidden />
      </button>
      <div
        className={cn(
          "absolute top-full z-10 pt-1 transition duration-[var(--dur-short)]",
          wide ? "left-0 w-[38rem]" : alignRight ? "right-0 min-w-56" : "left-1/2 min-w-52 -translate-x-1/2",
          open ? "visible opacity-100" : "invisible translate-y-1 opacity-0",
        )}
      >
        <div className={cn("rounded-2xl border border-line bg-paper shadow-float", wide ? "p-6" : "p-3")}>{children}</div>
      </div>
    </div>
  );
}
