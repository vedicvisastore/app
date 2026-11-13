"use client";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "../cart/cart-context";
import { useContent } from "./content-context";

const NAV_LINKS = [
  { href: "/shop?group=bhakti-boxes", key: "boxes" },
  { href: "/shop?group=japa-sets", key: "japa" },
  { href: "/shop?group=shringar-kits", key: "shringar" },
  { href: "/shop", key: "shopAll" },
] as const;

export function Header({ announcement, signedIn, isAdmin }: { announcement: string; signedIn: boolean; isAdmin: boolean }) {
  const copy = useContent().nav;
  const NAV = NAV_LINKS.map((n) => ({ href: n.href, label: copy[n.key] }));
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [bump, setBump] = useState(false);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!cart.count) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 350);
    return () => clearTimeout(t);
  }, [cart.count]);

  const parts = announcement.split("·").map((s) => s.trim()).filter(Boolean);

  return (
    <>
      {parts.length > 0 && (
        <div className="marquee-wrap overflow-hidden bg-royal text-white" aria-label="Store announcements">
          <div className="marquee py-2 text-[0.8125rem]">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0" aria-hidden={k === 1}>
                {Array.from({ length: 4 }).flatMap((_, i) =>
                  parts.map((p, j) => (
                    <span key={`${i}-${j}`} className="flex items-center gap-6 pr-6 whitespace-nowrap">
                      {p}
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
        <div className="wrap flex h-16 items-center gap-3 sm:h-[76px]">
          <button className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-sky lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Link href="/" className="shrink-0" aria-label="VedicVisa home">
            <Image src="/brand/logo.png" alt="VedicVisa" width={900} height={591} priority className="h-11 w-auto sm:h-[58px]" />
          </Link>
          <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="py-2 text-[0.95rem] text-ink transition-colors duration-[var(--dur-short)] hover:text-royal">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-8">
            <button className="grid size-10 place-items-center rounded-full hover:bg-sky" onClick={() => setSearch((s) => !s)} aria-label="Search" aria-expanded={search}>
              <Search className="size-5" />
            </button>
            {isAdmin && (
              <Link href="/admin" className="hidden rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:text-ink sm:block">
                Admin
              </Link>
            )}
            <Link href={signedIn ? "/account" : "/login"} className="grid size-10 place-items-center rounded-full hover:bg-sky" aria-label={signedIn ? "Your account" : "Log in"}>
              <User className="size-5" />
            </Link>
            <button onClick={() => cart.setOpen(true)} className="relative grid size-10 place-items-center rounded-full hover:bg-sky" aria-label={`Cart, ${cart.count} items`}>
              <ShoppingBag className="size-5" />
              {cart.count > 0 && (
                <span className={cn("absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-shyam transition-transform duration-[var(--dur-short)]", bump && "scale-125")}>
                  {cart.count}
                </span>
              )}
            </button>
          </div>
        </div>
        {search && (
          <form
            className="border-t border-line bg-paper"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(false);
              router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <Search className="size-5 text-ink-mute" aria-hidden />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.searchPlaceholder} className="h-10 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-mute" aria-label="Search products" />
              <button type="button" onClick={() => setSearch(false)} className="text-sm font-bold text-ink-soft">
                Close
              </button>
            </div>
          </form>
        )}
      </header>

      {/* Mobile menu */}
      <div className={cn("fixed inset-0 z-[400] overflow-hidden lg:hidden", !menu && "pointer-events-none invisible")} aria-hidden={!menu}>
        <div className={cn("absolute inset-0 bg-ink/30 transition-opacity", menu ? "opacity-100" : "opacity-0")} onClick={() => setMenu(false)} />
        <nav className={cn("absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col bg-paper p-5 shadow-float transition-transform duration-[var(--dur-long)] ease-[var(--ease-out)]", menu ? "translate-x-0" : "-translate-x-full")} aria-label="Mobile">
          <div className="mb-6 flex items-center justify-between">
            <Image src="/brand/logo.png" alt="VedicVisa" width={900} height={591} className="h-12 w-auto" />
            <button onClick={() => setMenu(false)} className="grid size-10 place-items-center rounded-full hover:bg-sky" aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="font-display border-b border-line py-4 text-2xl text-ink">
              {n.label}
            </Link>
          ))}
          <Link href={signedIn ? "/account" : "/login"} className="py-4 font-bold text-royal">
            {signedIn ? "Your orders" : "Log in"}
          </Link>
          {isAdmin && (
            <Link href="/admin" className="font-bold text-gold-ink">
              Admin panel
            </Link>
          )}
          <p className="deva mt-auto text-2xl text-gulal" lang="sa">धार्यते इति धर्मः</p>
        </nav>
      </div>
    </>
  );
}
