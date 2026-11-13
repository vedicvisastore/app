import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const trpc = await api();
  const [me, settings, categories, site] = await Promise.all([trpc.auth.me(), trpc.catalog.settings(), trpc.catalog.categories(), getSite()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-full focus:bg-royal focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header announcement={settings.announcement} signedIn={!!me} isAdmin={me?.role === "admin"} />
      <main id="main" className="pb-[var(--section-gap-s)]">{children}</main>
      <Footer settings={settings} categories={categories} copy={site.content.footer} />
      <CartDrawer />
    </>
  );
}
