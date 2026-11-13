import Image from "next/image";
import Link from "next/link";
import { PeacockFeather } from "@/components/site/ornaments";
import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="flex min-h-dvh flex-col items-center justify-center py-16 text-center">
      <Link href="/" className="mb-10"><Image src="/brand/logo.png" alt="VedicVisa" width={900} height={591} className="h-20 w-auto" /></Link>
      <PeacockFeather className="mb-4 h-32 w-auto" />
      <p className="font-display text-7xl text-royal">404</p>
      <h1 className="mt-2 text-4xl">This page wandered off</h1>
      <p className="mt-2 text-ink-soft">The link may be old, or the product is no longer available.</p>
      <ButtonLink href="/shop" className="mt-6">Go to the shop</ButtonLink>
    </Container>
  );
}
