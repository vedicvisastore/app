import { OrnamentDivider } from "./ornament";
import Image from "next/image";
import Link from "next/link";
import { socialUrl, type StoreSettings } from "@/lib/settings-defaults";
import type { SiteContent } from "@/content/defaults";
import type { ShopLink } from "@/lib/shop-links";
import { Container } from "../ui";
import { Rangoli } from "./ornaments";
import { InstagramIcon, YoutubeIcon } from "./social";

const linkCls = "inline-flex items-center gap-2.5 whitespace-nowrap leading-6 transition-colors duration-[var(--dur-short)] hover:text-gold";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm leading-6 text-on-shyam-2">{title}</p>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

export function Footer({ settings, categories = [], sets = [], copy }: { settings: StoreSettings; categories?: { slug: string; name: string }[]; sets?: ShopLink[]; copy: SiteContent["footer"] }) {
  const ig = socialUrl("instagram", settings.instagram);
  const yt = socialUrl("youtube", settings.youtube);
  const creator = socialUrl("instagram", settings.creatorInstagram);
  return (
    <footer className="on-dark relative overflow-hidden">
      <Rangoli spin className="absolute -right-24 -bottom-24 size-80 text-gold opacity-[0.07] sm:size-[26rem]" />
      <OrnamentDivider kind="diya" className="footer-ornament" />
      <Container className="relative grid gap-x-[var(--gap-columns)] gap-y-12 pt-16 pb-12 lg:grid-cols-12 lg:pt-20">
        <div className="flex items-start gap-5 lg:col-span-5">
          <Image src="/brand/logo-round.jpg" alt="VedicVisa" width={512} height={512} className="size-20 shrink-0 rounded-full sm:size-24" />
          <div className="min-w-0">
            <p className="deva text-[1.75rem] leading-tight text-gold" lang="sa">
              धार्यते इति धर्मः
            </p>
            <p className="mt-2 max-w-[36ch] text-on-shyam-2">{copy.blurb}</p>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-10 sm:grid-cols-3 lg:col-span-7" aria-label="Footer">
          <Column title={copy.shop}>
            {sets.map((s) => (
              <li key={s.slug}><Link className={linkCls} href={s.href}>{s.label}</Link></li>
            ))}
            <li><Link className={linkCls} href="/shop">Everything</Link></li>
          </Column>
          <Column title={copy.help}>
            <li><Link className={linkCls} href="/track">Track an order</Link></li>
            <li><Link className={linkCls} href="/shipping">Shipping and returns</Link></li>
            <li><Link className={linkCls} href="/about">Our story</Link></li>
          </Column>
          <Column title={copy.follow}>
            {ig && (
              <li>
                <a className={linkCls} href={ig} target="_blank" rel="noreferrer">
                  <InstagramIcon className="size-5 shrink-0" /> Instagram
                </a>
              </li>
            )}
            {creator && (
              <li>
                <a className={linkCls} href={creator} target="_blank" rel="noreferrer">
                  <InstagramIcon className="size-5 shrink-0" /> Meet the creator
                </a>
              </li>
            )}
            {yt && (
              <li>
                <a className={linkCls} href={yt} target="_blank" rel="noreferrer">
                  <YoutubeIcon className="size-5 shrink-0" /> YouTube
                </a>
              </li>
            )}
            {settings.supportEmail && <li className="leading-6 break-all">{settings.supportEmail}</li>}
            {settings.supportPhone && <li className="leading-6">{settings.supportPhone}</li>}
          </Column>
        </nav>
      </Container>

      {categories.length > 0 && (
        <Container>
          <div className="border-t border-shyam-3 py-8">
            <p className="text-sm leading-6 text-on-shyam-2">{copy.byCategory}</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link className={linkCls} href={`/shop?category=${c.slug}`}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      )}

      <Container>
        <div className="flex flex-col gap-2 border-t border-shyam-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-on-shyam-2 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} VedicVisa</p>
          <p>vedicvisa.com</p>
        </div>
      </Container>
    </footer>
  );
}
