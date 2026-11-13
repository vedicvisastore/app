"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Sort
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value === "trending") next.delete("sort");
          else next.set("sort", e.target.value);
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        className="h-10 rounded-full border-[1.5px] border-field-edge bg-paper px-3 text-ink"
      >
        <option value="trending">Popular</option>
        <option value="new">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
    </label>
  );
}
