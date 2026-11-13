import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@/server/caller";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const trpc = await api();
  const me = await trpc.auth.me();
  if (!me) redirect("/login?next=/checkout");
  const [addresses, config] = await Promise.all([trpc.account.addresses(), trpc.checkout.config()]);
  return <CheckoutForm email={me.email} addresses={addresses} mock={config.mock} adminTest={config.adminTest} />;
}
