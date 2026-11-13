"use client";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { ButtonLink, Spinner } from "@/components/ui";
import { ACCENT_DOT, festivalDay } from "@/lib/festival-accent";
import { FESTIVAL_STATE_LABEL, type FestivalState } from "@/lib/festival-status";
import { useTRPC } from "@/lib/trpc/client";
import { cn, storeHref } from "@/lib/utils";
import { Card, PageHeader } from "../_ui";

const STATE_TONE: Record<FestivalState, string> = {
  live: "bg-mor-soft text-mor",
  scheduled: "bg-haldi-soft text-gold-ink",
  off: "bg-line text-ink-soft",
  ended: "bg-line text-ink-mute",
};

function window_(from: Date | null, until: Date | null) {
  if (!from && !until) return "Showing all the time";
  if (from && until) return `Shows ${festivalDay(from)} – ${festivalDay(until)}`;
  if (from) return `Shows from ${festivalDay(from)}`;
  return `Shows until ${festivalDay(until)}`;
}

export default function FestivalsAdmin() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.admin.festivals.queryOptions());

  return (
    <>
      <PageHeader
        title="Custom pages"
        description="Your own store pages with products you pick: a festival like Holi, or anything else like Corporate gifting. Up to 2 can sit in the store menu."
        actions={
          <ButtonLink href="/admin/festivals/new" size="sm">
            <Plus className="size-4" aria-hidden /> Add page
          </ButtonLink>
        }
      />

      {isLoading && <Spinner className="text-ink-mute" />}

      {data?.length === 0 && (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <CalendarDays className="size-8 text-ink-mute" aria-hidden />
          <p className="text-lg font-bold">No custom pages yet</p>
          <p className="max-w-sm text-ink-soft">Make a page for a festival or a collection. You choose its name, colour, products and, if you like, the dates it shows.</p>
          <ButtonLink href="/admin/festivals/new" size="sm" className="mt-2">
            Add your first page
          </ButtonLink>
        </Card>
      )}

      {!!data?.length && (
        <ul className="space-y-3">
          {data.map((f) => (
            <li key={f.id}>
              <Card className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <Link href={`/admin/festivals/${f.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className={cn("grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl", ACCENT_DOT[f.accent])}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.image && <img src={f.image} alt="" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-lg font-bold">{f.name}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATE_TONE[f.state])}>{FESTIVAL_STATE_LABEL[f.state]}</span>
                      {f.showInMenu && f.state === "live" && <span className="rounded-full bg-sky px-2.5 py-0.5 text-xs text-ink-soft">In menu</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-soft">
                      {f.productCount} {f.productCount === 1 ? "product" : "products"} · {window_(f.showFrom, f.showUntil)}
                    </span>
                  </span>
                </Link>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  {f.state === "live" && (
                    <a href={storeHref(`/c/${f.slug}`)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-soft hover:text-ink">
                      View <ExternalLink className="size-4" aria-hidden />
                    </a>
                  )}
                  <ButtonLink href={`/admin/festivals/${f.id}`} size="sm" variant="outline" className="flex-1 sm:flex-none">
                    Edit
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
