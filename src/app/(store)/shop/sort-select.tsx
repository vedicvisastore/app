"use client";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Sort
      <span className="relative">
        <select
          value={value}
          onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            if (e.target.value === "trending") next.delete("sort");
            else next.set("sort", e.target.value);
            router.push(`${pathname}?${next.toString()}`, { scroll: false });
          }}
          className="h-10 cursor-pointer appearance-none rounded-full border border-line-strong bg-paper pr-10 pl-4 text-sm text-ink transition-colors hover:border-ink focus-visible:border-royal"
        >
          <option value="trending">Popular</option>
          <option value="new">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-soft"
          aria-hidden
        />
      </span>
    </label>
  );
}
