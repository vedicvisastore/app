import type { Metadata, Viewport } from "next";
import { Rozha_One } from "next/font/google";
import { CartProvider } from "@/components/cart/cart-context";
import { ContentProvider } from "@/components/site/content-context";
import { getSite } from "@/server/site-config";
import { TRPCReactProvider } from "@/lib/trpc/client";
import "./globals.css";

// Rozha One (display, Latin + Devanagari) and Satoshi (body) are both by the Indian Type Foundry.
const rozha = Rozha_One({ weight: "400", subsets: ["latin", "devanagari"], variable: "--font-rozha", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "VedicVisa: Bhakti Boxes, Japa Malas and Puja Essentials", template: "%s | VedicVisa" },
  description:
    "Hand-packed Bhakti Boxes, Tulsi japa malas, tilak kits and puja essentials for a new generation of devotees. Shipped to every pincode in India by India Post.",
  icons: { icon: "/brand/icon.png", apple: "/brand/apple-icon.png" },
  openGraph: { siteName: "VedicVisa", images: ["/brand/logo-round.jpg"], locale: "en_IN", type: "website" },
};

export const viewport: Viewport = { themeColor: "#121a4a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme + editable copy: one cached read (R2 file), never a database query.
  const site = await getSite();
  return (
    <html lang="en-IN" className={rozha.variable} data-theme={site.themeKey}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,700&display=swap" />
        {site.themeCss && <style id="vv-theme" dangerouslySetInnerHTML={{ __html: site.themeCss }} />}
      </head>
      <body>
        <TRPCReactProvider>
          <ContentProvider content={site.content}>
            <CartProvider>{children}</CartProvider>
          </ContentProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
