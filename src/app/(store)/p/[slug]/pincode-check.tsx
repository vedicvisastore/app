"use client";
import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useContent } from "@/components/site/content-context";

export function PincodeCheck({ daysMin, daysMax }: { daysMin: number; daysMax: number }) {
  const copy = useContent().product;
  const trpc = useTRPC();
  const [pin, setPin] = useState("");
  const [submitted, setSubmitted] = useState("");
  const valid = /^[1-9]\d{5}$/.test(submitted);
  const { data, isFetching } = useQuery({ ...trpc.pincode.lookup.queryOptions({ pincode: submitted }), enabled: valid });

  const eta = () => {
    const d = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `${d(daysMin)} – ${d(daysMax)}`;
  };

  return (
    <div className="flex items-start gap-3 text-sm">
      <Truck className="mt-2 size-4 shrink-0 text-yamuna" aria-hidden />
      <div className="flex-1">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(pin);
          }}
        >
          <label htmlFor="pin" className="sr-only">
            Delivery pincode
          </label>
          <input
            id="pin"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder={copy.pincodePlaceholder}
            className="field h-11 !rounded-full !py-1 text-base sm:h-9 sm:text-sm"
          />
          <button className="shrink-0 rounded-full px-3 font-bold text-royal hover:bg-sky disabled:opacity-40" disabled={pin.length !== 6}>
            Check
          </button>
        </form>
        <p className="mt-1.5 text-ink-soft" aria-live="polite">
          {submitted && !valid && "Enter a valid 6-digit pincode."}
          {valid && isFetching && "Checking…"}
          {valid && !isFetching && data?.found && (
            <>
              Delivers to <b className="text-ink">{data.city}, {data.state}</b> by India Post, usually {eta()}.
            </>
          )}
          {valid && !isFetching && data && !data.found && ("offline" in data ? `India Post delivers across India, usually ${daysMin}–${daysMax} days.` : "We couldn't find this pincode. Check the number.")}
        </p>
      </div>
    </div>
  );
}
