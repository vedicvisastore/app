import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  pending_payment: "bg-line text-ink-soft",
  paid: "bg-yamuna-soft text-yamuna",
  packed: "bg-haldi-soft text-gold-ink",
  shipped: "bg-paper-3 text-royal",
  delivered: "bg-mor-soft text-mor",
  cancelled: "bg-gulal-soft text-gulal",
  refunded: "bg-gulal-soft text-gulal",
};

export function StatusPill({ status, label, className }: { status: string; label: string; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", TONE[status] ?? TONE.pending_payment, className)}>{label}</span>;
}
