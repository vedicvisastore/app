"use client";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "../cart/cart-context";

export function QuickAdd({ productId, disabled, name }: { productId: number; disabled?: boolean; name: string }) {
  const cart = useCart();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        cart.add(productId);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      aria-label={`Add ${name} to cart`}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors disabled:opacity-30",
        done ? "border-mor bg-mor text-white" : "border-ink/15 text-ink hover:border-royal hover:bg-royal hover:text-white",
      )}
    >
      {done ? <Check className="size-4" /> : <Plus className="size-4" />}
    </button>
  );
}
