"use client";
import { ChevronDown, ChevronRight, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RibbonItem } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";
import { useCart } from "../cart/cart-context";
import { useContent } from "./content-context";

export type MenuFestival = { name: string; slug: string; accent: string };
export type MenuCategory = { name: string; slug: string };

const DOT: Record<string, string> = { gulal: "bg-gulal", gold: "bg-gold", royal: "bg-royal", peacock: "bg-peacock", mor: "bg-mor" };

type Props = {
  ribbon: RibbonItem[];
  ribbonSeconds: number;
  signedIn: boolean;
  isAdmin: boolean;
  categories: MenuCategory[];
  festivals: MenuFestival[];
};

export function Header({ ribbon, ribbonSeconds, signedIn, isAdmin, categories, festivals }: Props) {
  const copy = useContent().nav;
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [q, setQ] = useState("");
  const [bump, setBump] = useState(false);
  const shopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenu(false);
    setShopOpen(false);
    setSearch(false);
  }, [pathname]);
  useEffect(() => {
    if (!cart.count) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 350);
    return () => clearTimeout(t);
  }, [cart.count]);
  useEffect(() => {
    if (!shopOpen && !menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setShopOpen(false), setMenu(false));
    const onClick = (e: MouseEvent) => shopRef.current && !shopRef.current.contains(e.target as Node) && setShopOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [shopOpen, menu]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => void (document.body.style.overflow = "");
  }, [menu]);

  const sets = [
    { href: "/shop?group=bhakti-boxes", label: copy.boxes },
    { href: "/shop?group=japa-sets", label: copy.japa },
    { href: "/shop?group=shringar-kits", label: copy.shringar },
  ];
  const cats = categories.filter((c) => c.slug !== "bhakti-boxes-kits");
  const links = [
    { href: "/new", label: copy.newLaunches },
    { href: "/deals", label: copy.deals, dot: "bg-gulal" },
    ...festivals.map((f) => ({ href: `/c/${f.slug}`, label: f.name, dot: DOT[f.accent] ?? "bg-gulal" })),
    { href: "/track", label: copy.track },
  ];
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
        <div className="marquee-wrap overflow-hidden bg-royal text-white" aria-label="Store announcements">
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
                      <svg viewBox="0 0 10 10" className="size-2 fill-gold" aria-hidden>
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

      <header className="sticky top-0 z-[300] border-b border-line bg-paper">
        {/* Top row: search · logo (centre) · account and cart */}
        <div className="wrap grid h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-3 sm:h-20 lg:h-[100px]">
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
            <Image src="/brand/logo.png" alt="VedicVisa" width={900} height={591} priority className="h-[52px] w-auto sm:h-[60px] lg:h-[80px]" />
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
              {cart.count > 0 && (
                <span className={cn("absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-shyam transition-transform duration-[var(--dur-short)]", bump && "scale-125")}>
                  {cart.count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Second row (desktop): the menu */}
        <nav className="hidden border-t border-line lg:block" aria-label="Main">
          <ul className="wrap flex h-12 items-center justify-center gap-9">
            <li>
              <div ref={shopRef} className="relative" onMouseEnter={() => setShopOpen(true)} onMouseLeave={() => setShopOpen(false)}>
                <button
                  className={cn("flex items-center gap-1 py-3 text-[0.95rem] transition-colors hover:text-royal", pathname.startsWith("/shop") ? "font-bold text-ink" : "text-ink-soft")}
                  aria-expanded={shopOpen}
                  aria-haspopup="true"
                  onClick={() => setShopOpen((o) => !o)}
                >
                  {copy.shop}
                  <ChevronDown className={cn("size-4 transition-transform duration-[var(--dur-short)]", shopOpen && "rotate-180")} aria-hidden />
                </button>
                <div className={cn("absolute top-full left-1/2 w-[38rem] -translate-x-1/2 pt-1 transition duration-[var(--dur-short)]", shopOpen ? "visible opacity-100" : "invisible translate-y-1 opacity-0")}>
                  <div className="grid grid-cols-[1fr_1.6fr] gap-6 rounded-2xl border border-line bg-paper p-6 shadow-float">
                    <div>
                      <p className="text-xs font-bold tracking-[0.08em] uppercase mb-3 text-ink-mute">{copy.byType}</p>
                      <ul className="space-y-1">
                        {sets.map((s) => (
                          <li key={s.href}>
                            <Link href={s.href} className="font-display block py-1 text-xl text-ink hover:text-royal">
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
                      <p className="text-xs font-bold tracking-[0.08em] uppercase mb-3 text-ink-mute">{copy.byCategory}</p>
                      <ul className={cn("gap-x-6", cats.length > 9 ? "columns-2" : "")}>
                        {cats.map((c) => (
                          <li key={c.slug}>
                            <Link href={`/shop?category=${c.slug}`} className="block py-1 text-[0.95rem] text-ink-soft hover:text-royal">
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </li>
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={cn("flex items-center gap-2 py-3 text-[0.95rem] transition-colors hover:text-royal", isActive(l.href) ? "font-bold text-ink" : "text-ink-soft")}
                >
                  {"dot" in l && l.dot && <span className={cn("size-1.5 rounded-full", l.dot)} aria-hidden />}
                  {l.label}
                </Link>
              </li>
            ))}
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

      {/* Mobile menu */}
      <div className={cn("fixed inset-0 z-[400] overflow-hidden lg:hidden", !menu && "pointer-events-none invisible")} aria-hidden={!menu}>
        <div className={cn("absolute inset-0 bg-ink/30 transition-opacity", menu ? "opacity-100" : "opacity-0")} onClick={() => setMenu(false)} />
        <nav
          className={cn(
            "absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-paper px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-float transition-transform duration-[var(--dur-long)] ease-[var(--ease-out)]",
            menu ? "translate-x-0" : "-translate-x-full",
          )}
          aria-label="Mobile"
        >
          <div className="mb-4 flex items-center justify-between">
            <Image src="/brand/logo.png" alt="VedicVisa" width={900} height={591} className="h-11 w-auto" />
            <button onClick={() => setMenu(false)} className={iconBtn} aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>

          <form onSubmit={submitSearch} role="search" className="mb-2">
            <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-paper-2 px-4 focus-within:border-royal">
              <Search className="size-4 text-ink-mute" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.searchPlaceholder} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-mute" aria-label="Search products" />
            </label>
          </form>

          <MobileGroup title={copy.byType}>
            {sets.map((s) => (
              <MobileLink key={s.href} href={s.href} big>
                {s.label}
              </MobileLink>
            ))}
            <MobileLink href="/shop">{copy.shopAll}</MobileLink>
          </MobileGroup>

          <MobileGroup>
            {links
              .filter((l) => !l.href.startsWith("/c/"))
              .map((l) => (
                <MobileLink key={l.href} href={l.href} dot={"dot" in l ? l.dot : undefined}>
                  {l.label}
                </MobileLink>
              ))}
          </MobileGroup>

          {festivals.length > 0 && (
            <MobileGroup title={copy.festivalsTitle}>
              {festivals.map((f) => (
                <MobileLink key={f.slug} href={`/c/${f.slug}`} dot={DOT[f.accent] ?? "bg-gulal"}>
                  {f.name}
                </MobileLink>
              ))}
            </MobileGroup>
          )}

          {cats.length > 0 && (
            <MobileGroup title={copy.byCategory}>
              <div className="flex flex-wrap gap-2 pt-1">
                {cats.map((c) => (
                  <Link key={c.slug} href={`/shop?category=${c.slug}`} className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft">
                    {c.name}
                  </Link>
                ))}
              </div>
            </MobileGroup>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
            <Link href={signedIn ? "/account" : "/login"} className="font-bold text-royal">
              {signedIn ? "Your account and orders" : "Log in"}
            </Link>
            {isAdmin && (
              <Link href="/admin" className="font-bold text-gold-ink">
                Admin panel
              </Link>
            )}
          </div>
          <p className="deva mt-auto pt-8 text-2xl text-gulal" lang="sa">
            धार्यते इति धर्मः
          </p>
        </nav>
      </div>
    </>
  );
}

function MobileGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-3">
      {title && <p className="text-xs font-bold tracking-[0.08em] uppercase pt-1 pb-1 text-ink-mute">{title}</p>}
      {children}
    </div>
  );
}

function MobileLink({ href, children, big, dot }: { href: string; children: React.ReactNode; big?: boolean; dot?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 py-2.5 text-ink", big ? "font-display text-2xl" : "text-[1.05rem]")}>
      {dot && <span className={cn("size-2 rounded-full", dot)} aria-hidden />}
      {children}
    </Link>
  );
}
