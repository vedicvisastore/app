import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink, Container } from "@/components/ui";
import { getSite } from "@/server/site-config";

export const metadata: Metadata = { title: "Our story" };

export default async function About() {
  const c = (await getSite()).content.about;
  return (
    <Container className="grid items-center gap-12 pt-14 md:grid-cols-2">
      <div className="arch-frame mx-auto w-full max-w-[380px]">
        <div className="arch relative aspect-[4/5] overflow-hidden">
          <Image src="/brand/hero-temple.jpg" alt="" fill className="object-cover" sizes="380px" />
        </div>
      </div>
      <div className="max-w-xl">
        <p className="font-display text-2xl text-gulal" lang="sa">धार्यते इति धर्मः</p>
        <h1 className="mt-2 text-[length:var(--text-display-s)]">{c.title}</h1>
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">
          <p>{c.p1}</p>
          <p>{c.p2}</p>
          <p>{c.p3}</p>
        </div>
        <ButtonLink href="/shop?group=bhakti-boxes" className="mt-8" size="lg">
          {c.cta}
        </ButtonLink>
      </div>
    </Container>
  );
}
