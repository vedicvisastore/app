import type { Metadata } from "next";
import { Clock, Mail, PackageSearch, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/site/page-intro";
import { InstagramIcon } from "@/components/site/social";
import { Container } from "@/components/ui";
import { socialHandle, socialUrl } from "@/lib/settings-defaults";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";

export const metadata: Metadata = { title: "Contact and support", description: "Reach VedicVisa for help with orders, gifts and Bhakti Boxes." };

export default async function ContactPage() {
  const trpc = await api();
  const [settings, { content }] = await Promise.all([trpc.catalog.settings(), getSite()]);
  const c = content.pages;
  const ig = socialUrl("instagram", settings.instagram);
  const ways = [
    settings.supportEmail && { icon: Mail, label: "Email", value: settings.supportEmail, href: `mailto:${settings.supportEmail}` },
    settings.supportPhone && { icon: Phone, label: "Phone / WhatsApp", value: settings.supportPhone, href: `tel:${settings.supportPhone.replace(/\s/g, "")}` },
    ig && { icon: InstagramIcon, label: "Instagram", value: socialHandle(ig) ?? "Instagram", href: ig },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; label: string; value: string; href: string }[];

  return (
    <>
      <PageIntro title={c.contactTitle} lede={c.contactLede} />
      <Container className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          {ways.map((w) => (
            <a key={w.label} href={w.href} target={w.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-royal/40 hover:bg-sky/40">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gulal-soft text-gulal">
                <w.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-ink-soft">{w.label}</span>
                <span className="block truncate text-lg font-bold group-hover:text-royal">{w.value}</span>
              </span>
            </a>
          ))}
          <p className="flex items-center gap-2 px-1 pt-2 text-sm text-ink-soft">
            <Clock className="size-4" aria-hidden /> {c.contactHours}
          </p>
        </div>
        <div className="space-y-3">
          <Link href="/track" className="flex gap-4 rounded-2xl bg-mor-soft p-5 transition-transform hover:-translate-y-0.5">
            <PackageSearch className="mt-0.5 size-6 shrink-0 text-mor" aria-hidden />
            <span>
              <span className="block font-bold">{c.contactOrderTitle}</span>
              <span className="text-sm text-ink-soft">{c.contactOrderBody}</span>
            </span>
          </Link>
          <div className="flex gap-4 rounded-2xl bg-gold-soft p-5">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-gold-ink" aria-hidden />
            <span>
              <span className="block font-bold">{c.contactDamageTitle}</span>
              <span className="text-sm text-ink-soft">{c.contactDamageBody}</span>
            </span>
          </div>
          <Link href="/shipping" className="block px-1 pt-1 text-sm font-bold text-royal">
            {content.nav.shipping} →
          </Link>
        </div>
      </Container>
    </>
  );
}
