import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@/server/caller";
import { AdminShell } from "./shell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | VedicVisa Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await (await api()).auth.me();
  if (!me) redirect("/login?next=/admin");
  if (me.role !== "admin") redirect("/");
  return <AdminShell email={me.email}>{children}</AdminShell>;
}
