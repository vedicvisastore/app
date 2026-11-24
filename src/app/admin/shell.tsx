"use client";
import { GalleryHorizontal, PanelTop, Users, CalendarHeart, Map as MapIcon, Megaphone, Palette, Type, BadgePercent, Boxes, FileSpreadsheet, FolderTree, LayoutDashboard, Menu, Package, Settings, ShoppingCart, Store, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, storeHref } from "@/lib/utils";
import { ToastProvider } from "./_ui";

type NavItem = { href: string; label: string; icon: typeof Package; exact?: boolean };
/** Admin menu in groups by job, so related pages sit together. Groups are always open (owner's call). */
const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  {
    title: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/analytics", label: "Analytics", icon: MapIcon },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/bundles", label: "Boxes & bundles", icon: Boxes },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
    ],
  },
  {
    title: "Promotions",
    items: [
      { href: "/admin/discounts", label: "Sales & coupons", icon: BadgePercent },
      { href: "/admin/festivals", label: "Custom pages", icon: CalendarHeart },
      { href: "/admin/ribbon", label: "Top ribbon", icon: Megaphone },
    ],
  },
  {
    title: "Storefront",
    items: [
      { href: "/admin/content", label: "Visual editor", icon: Type },
      { href: "/admin/hero", label: "Home banner", icon: GalleryHorizontal },
      { href: "/admin/menu", label: "Shop menu", icon: PanelTop },
      { href: "/admin/themes", label: "Themes", icon: Palette },
    ],
  },
  {
    title: "Setup",
    items: [
      { href: "/admin/import", label: "Import Excel", icon: FileSpreadsheet },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-4" aria-label="Admin">
      {NAV.map((g, gi) => (
        <div key={g.title ?? gi}>
          {g.title && <p className="mb-1 px-3 text-[0.7rem] font-bold tracking-[0.12em] text-ink-mute uppercase">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.93rem] transition-colors",
                      active ? "bg-paper font-bold text-royal shadow-lift" : "text-ink-soft hover:bg-paper/60 hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-gold" aria-hidden />}
                    <n.icon className="size-[18px] shrink-0" aria-hidden />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto space-y-1 border-t border-line-strong/50 pt-4">
        <a href={storeHref("/")} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-normal text-ink-soft hover:text-royal">
          <Store className="size-[18px]" aria-hidden /> View store
        </a>
        <p className="truncate px-3 text-xs text-ink-mute">{email}</p>
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto bg-sky p-4 lg:flex">
          <Link href="/admin" className="flex items-center gap-2 px-2 pt-2">
            <Image src="/brand/logo.png" alt="VedicVisa" width={900} height={591} className="h-12 w-auto" />
            <span className="rounded-full bg-haldi-soft px-2 py-0.5 text-[11px] font-bold text-gold-ink">Admin</span>
          </Link>
          {nav}
        </aside>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-sky" aria-label="Open admin menu">
            <Menu className="size-5" />
          </button>
          <Image src="/brand/logo.png" alt="VedicVisa" width={900} height={591} className="h-9 w-auto" />
          <span className="w-10" />
        </header>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-5 overflow-y-auto bg-sky p-4">
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center self-end rounded-full hover:bg-paper" aria-label="Close menu">
                <X className="size-5" />
              </button>
              {nav}
            </aside>
          </div>
        )}
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
