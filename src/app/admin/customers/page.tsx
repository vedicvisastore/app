"use client";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageLoader } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { customerHref, formatDate, inr } from "@/lib/utils";
import { Card, PageHeader, Pagination, td, th, usePaged } from "../_ui";

export default function CustomersPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery(trpc.admin.customers.queryOptions({ q: q.trim() || undefined }));
  const list = data ?? [];
  const buyers = list.filter((c) => c.orders > 0).length;
  const paged = usePaged(list, q);

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has an account or has placed an order. Tap one to see their details and every order they have placed." />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <Search className="size-4 text-ink-mute" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or city" className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" aria-label="Search customers" />
          </label>
          <p className="text-sm text-ink-soft">{list.length} people · {buyers} have ordered</p>
        </div>
        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            {/* Phones: cards */}
            <ul className="divide-y divide-line md:hidden">
              {paged.rows.map((c) => (
                <li key={c.email}>
                  <Link href={customerHref(c.email)} className="block px-4 py-3 active:bg-sky">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-bold">{c.name ?? c.email}</span>
                      <span className="shrink-0 font-bold tabular-nums">{inr(c.spent)}</span>
                    </span>
                    <span className="block truncate text-sm text-ink-soft">{c.email}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-mute">
                      <span>{c.orders} {c.orders === 1 ? "order" : "orders"}</span>
                      {c.open > 0 && <span className="font-bold text-royal">{c.open} open</span>}
                      {c.lastOrder && <span>Last {formatDate(c.lastOrder)}</span>}
                      {!c.account && <span>Guest</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Wider screens: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-sky/40">
                    <th className={th}>Customer</th>
                    <th className={th}>Phone</th>
                    <th className={th}>Place</th>
                    <th className={`${th} text-right`}>Orders</th>
                    <th className={`${th} text-right`}>Spent</th>
                    <th className={th}>Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((c) => (
                    <tr key={c.email} className="cursor-pointer border-b border-line last:border-0 hover:bg-sky/40" onClick={() => router.push(customerHref(c.email))}>
                      <td className={td}>
                        <Link href={customerHref(c.email)} className="font-bold text-royal" onClick={(e) => e.stopPropagation()}>
                          {c.name ?? c.email}
                        </Link>
                        <p className="text-xs text-ink-mute">
                          {c.email}
                          {!c.account && " · guest"}
                          {c.admin && " · admin"}
                        </p>
                      </td>
                      <td className={td}>{c.phone ?? <span className="text-ink-mute">—</span>}</td>
                      <td className={td}>{c.city ? `${c.city}, ${c.state}` : <span className="text-ink-mute">—</span>}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        {c.orders}
                        {c.open > 0 && <span className="ml-1.5 rounded-full bg-sky px-1.5 text-xs font-bold text-royal">{c.open} open</span>}
                      </td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{inr(c.spent)}</td>
                      <td className={td}>{c.lastOrder ? formatDate(c.lastOrder) : <span className="text-ink-mute">Never</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-mute">No customers match.</p>}
            <Pagination {...paged.bar} noun="people" />
          </>
        )}
      </Card>
    </>
  );
}
