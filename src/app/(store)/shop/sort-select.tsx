"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { Select } from "@/components/select";

const SORTS = [
  { value: "trending", label: "Popular" },
  { value: "new", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm text-ink-soft">
      <span id={id}>Sort</span>
      <Select
        look="pill"
        aria-labelledby={id}
        value={value}
        menuMinWidth={190}
        className="min-w-[10.5rem]"
        onChange={(v) => {
          const next = new URLSearchParams(params.toString());
          if (v === "trending") next.delete("sort");
          else next.set("sort", v);
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        options={SORTS}
      />
    </div>
  );
}
