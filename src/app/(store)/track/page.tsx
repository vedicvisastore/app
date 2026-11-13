import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";
import { api } from "@/server/caller";
import { getSite } from "@/server/site-config";
import { TrackForm } from "./track-form";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [{ content }, me, sp] = await Promise.all([getSite(), (await api()).auth.me(), searchParams]);
  const c = content.pages;
  return (
    <Container className="max-w-2xl py-12 sm:py-16">
      <h1 className="text-[length:var(--text-display-s)]">{c.trackTitle}</h1>
      <p className="lead mt-3 text-ink-soft">{c.trackLede}</p>
      {me && (
        <Link href="/account" className="mt-3 inline-block font-bold text-royal">
          {c.trackSignedIn} →
        </Link>
      )}
      <TrackForm defaultEmail={me?.email ?? ""} defaultNumber={sp.order?.slice(0, 20) ?? ""} />
    </Container>
  );
}
