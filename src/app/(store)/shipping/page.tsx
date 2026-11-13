import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { inr } from "@/lib/utils";
import { api } from "@/server/caller";

export const metadata: Metadata = { title: "Shipping and returns" };

export default async function Shipping() {
  const s = await (await api()).catalog.settings();
  return (
    <Container className="max-w-2xl pt-14">
      <h1 className="text-[length:var(--text-display-s)]">Shipping and returns</h1>
      <div className="mt-8 space-y-8 text-ink-soft [&_h2]:font-sans [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink">
        <section>
          <h2>Delivery</h2>
          <p className="mt-2">
            We ship every order through India Post (Speed Post or registered parcel) to all serviceable pincodes. Orders are packed within 1–2 working days and usually arrive in {s.deliveryDaysMin}–{s.deliveryDaysMax} days.
          </p>
        </section>
        <section>
          <h2>Shipping charges</h2>
          <p className="mt-2">
            {s.freeShippingThreshold > 0 ? `Shipping is free on orders of ${inr(s.freeShippingThreshold)} or more. Below that, a flat ${inr(s.shippingFee)} applies.` : "Shipping is free on every order."}
          </p>
        </section>
        <section>
          <h2>Tracking</h2>
          <p className="mt-2">Once your parcel ships, its India Post tracking number appears on your order page in your account.</p>
        </section>
        <section>
          <h2>Damaged or missing items</h2>
          <p className="mt-2">
            Record a short unboxing video or take photos, and write to {s.supportEmail || "us"} within 48 hours of delivery. We’ll send a replacement for anything damaged or missing. As these are devotional items, we don’t accept returns of opened products otherwise.
          </p>
        </section>
      </div>
    </Container>
  );
}
