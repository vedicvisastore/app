import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container, Media, ProductArt } from "@/components/ui";
import { formatDate, inr, ORDER_STATUS_LABEL } from "@/lib/utils";
import { api } from "@/server/caller";
import { AddressBook } from "./address-book";
import { LogoutButton } from "./logout-button";
import { ProfileForm } from "./profile-form";
import { StatusPill } from "./status-pill";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const trpc = await api();
  const me = await trpc.auth.me();
  if (!me) redirect("/login?next=/account");
  const [orders, addresses] = await Promise.all([trpc.account.orders(), trpc.account.addresses()]);

  return (
    <Container className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--text-display-s)]">Hare Krishna{me.name ? `, ${me.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-2 text-ink-soft">{me.email}</p>
        </div>
        <LogoutButton />
      </div>

      <nav className="no-scrollbar -mx-[var(--gutter)] mt-8 flex gap-2 overflow-x-auto px-[var(--gutter)]" aria-label="Account sections">
        {[
          ["#orders-section", `Orders${orders.length ? ` (${orders.length})` : ""}`],
          ["#addresses", `Addresses${addresses.length ? ` (${addresses.length})` : ""}`],
          ["#details", "Personal details"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border border-line px-4 py-2 text-sm whitespace-nowrap hover:border-ink">
            {label}
          </a>
        ))}
      </nav>

      <section className="mt-10 scroll-mt-28" id="orders-section" aria-labelledby="orders">
        <h2 id="orders" className="font-sans text-xl font-bold">Your orders</h2>
        {orders.length === 0 ? (
          <div className="mt-4 rounded-3xl bg-sky p-8 text-center">
            <p className="font-display text-2xl">No orders yet</p>
            <p className="mt-1 text-ink-soft">When you place an order, you can track it here.</p>
            <Link href="/shop" className="mt-4 inline-block font-bold text-royal hover:underline">Browse the shop</Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4 transition-colors hover:border-royal/40 hover:bg-sky/40">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 3).map((it) => (
                      <div key={it.id} className="h-14 w-12 overflow-hidden rounded-lg border-2 border-paper bg-sky">
                        {it.image ? <Media src={it.image} alt="" className="h-full w-full object-cover" /> : <ProductArt name={it.name} seed={it.productId ?? it.id} />}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{o.number}</p>
                    <p className="truncate text-sm text-ink-soft">{o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>
                    <p className="text-xs text-ink-mute">{formatDate(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                    <p className="mt-1 font-bold tabular-nums">{inr(o.total)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14 scroll-mt-28" id="addresses" aria-labelledby="addresses-h">
        <h2 id="addresses-h" className="font-sans text-xl font-bold">Saved addresses</h2>
        <AddressBook addresses={addresses} />
      </section>

      <section className="mt-14 scroll-mt-28" id="details" aria-labelledby="details-h">
        <h2 id="details-h" className="font-sans text-xl font-bold">Personal details</h2>
        <ProfileForm name={me.name} phone={me.phone} email={me.email} />
      </section>
    </Container>
  );
}
