import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@/server/caller";
import { Inter } from "next/font/google";
import { AdminShell } from "./shell";
import "./admin.css";

// The admin uses one plain, professional font; the store keeps its own fonts and design.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = { title: { default: "Admin", template: "%s | VedicVisa Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await (await api()).auth.me();
  if (!me) redirect("/login?next=/admin");
  if (me.role !== "admin") redirect("/");
  return (
    <div className={`${inter.variable} admin-ui`}>
      <AdminShell email={me.email}>{children}</AdminShell>
    </div>
  );
}
