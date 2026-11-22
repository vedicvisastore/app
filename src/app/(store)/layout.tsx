import { CartDrawer } from "@/components/cart/cart-drawer";
import "./motion.css";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { FramedNoScrollbar, PreviewScrollKeeper, VisualEditBridge } from "@/components/site/preview-scroll";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";
import { shopLinks } from "@/lib/shop-links";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const trpc = await api();
  const [me, settings, categories, site, festivals, live] = await Promise.all([trpc.auth.me(), trpc.catalog.settings(), trpc.catalog.categories(), getSite(), trpc.catalog.festivals(), trpc.catalog.groups()]);
  const sets = shopLinks(live.groups, live.items, site.content.nav);
  // Shop menu categories: the admin's pick and order (Admin → Shop menu), or every category with products.
  const pick = settings.menuCategories;
  const menuCats = pick.length ? pick.map((slug) => categories.find((c) => c.slug === slug)).filter((c) => !!c) : categories;
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-full focus:bg-royal focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header
        ribbon={settings.ribbon}
        ribbonSeconds={settings.ribbonSeconds}
        signedIn={!!me}
        isAdmin={me?.role === "admin"}
        categories={menuCats.map((c) => ({ name: c.name, slug: c.slug }))}
        sets={sets}
        festivals={festivals.filter((f) => f.showInMenu).slice(0, 2).map((f) => ({ name: f.name, slug: f.slug, accent: f.accent }))}
      />
      <main id="main" className="pb-[var(--section-gap-s)]">{children}</main>
      <Footer settings={settings} categories={categories} sets={sets} copy={site.content.footer} logo={site.images["brand.logoRound"]} />
      <CartDrawer />
      <FramedNoScrollbar />
      {(site.previewing || site.editing) && <PreviewScrollKeeper />}
      {site.editing && <VisualEditBridge />}
      {site.previewing && !site.editing && (
        <p className="pointer-events-none fixed bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white shadow-float">Preview: unsaved store text</p>
      )}
    </>
  );
}
