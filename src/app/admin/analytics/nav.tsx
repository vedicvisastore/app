"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Switch between the analytics views. */
export function AnalyticsNav() {
  const path = usePathname();
  const onProducts = path.includes("/analytics/products");
  const item = (active: boolean) => cn("h-9 rounded-full px-4 text-sm font-bold leading-9", active ? "bg-paper text-ink shadow-lift" : "text-ink-soft hover:text-ink");
  return (
    <nav className="mb-5 inline-flex rounded-full bg-sky p-1" aria-label="Analytics views">
      <Link href="/admin/analytics" className={item(!onProducts)}>
        Where orders come from
      </Link>
      <Link href="/admin/analytics/products" className={item(onProducts)}>
        Products
      </Link>
    </nav>
  );
}
