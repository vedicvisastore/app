import Link from "next/link";
import { cn, inr, isVideo, pctOff } from "@/lib/utils";

type BtnProps = {
  variant?: "primary" | "outline" | "ghost" | "gold" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function btnClass({ variant = "primary", size = "md", className }: BtnProps = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap select-none transition-[background-color,color,border-color,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] active:translate-y-px disabled:opacity-55 disabled:cursor-not-allowed aria-disabled:opacity-55",
    size === "sm" && "h-10 px-4 text-sm",
    size === "md" && "h-12 px-6 text-[0.95rem]",
    size === "lg" && "h-[52px] px-8 text-base",
    // One filled recipe across the store: bansuri gold with Shyam ink. "gold" is kept as an alias.
    (variant === "primary" || variant === "gold") && "bg-gold text-shyam hover:bg-[color-mix(in_oklab,var(--color-gold)_88%,var(--color-ink))]",
    variant === "outline" && "border-[1.5px] border-current/30 hover:border-current",
    variant === "ghost" && "text-ink-soft hover:text-ink hover:bg-sky",
    variant === "danger" && "bg-gulal-soft text-gulal hover:bg-gulal hover:text-white",
    className,
  );
}

export function Button({ variant, size, className, ...rest }: BtnProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={btnClass({ variant, size, className })} {...rest} />;
}

export function ButtonLink({ variant, size, className, ...rest }: BtnProps & React.ComponentProps<typeof Link>) {
  return <Link className={btnClass({ variant, size, className })} {...rest} />;
}

export function Price({ price, mrp, size = "md", className }: { price: number; mrp?: number | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const off = pctOff(price, mrp);
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-bold text-ink tabular-nums", size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-base")}>{inr(price)}</span>
      {off > 0 && (
        <>
          <s className={cn("text-ink-mute tabular-nums", size === "lg" ? "text-lg" : "text-sm")}>{inr(mrp!)}</s>
          <span className={cn("font-bold text-gulal", size === "lg" ? "text-base" : "text-sm")}>{off}% off</span>
        </>
      )}
    </span>
  );
}

const SWATCHES = [
  "bg-royal text-white [--arch:var(--color-royal-deep)]",
  "bg-peacock text-white [--arch:var(--color-peacock-deep)]",
  "bg-gold text-shyam [--arch:var(--color-gold-deep)]",
  "bg-gulal text-white [--arch:var(--color-gulal-deep)]",
  "bg-mor text-white [--arch:var(--color-mor-deep)]",
  "bg-shyam text-on-shyam [--arch:var(--color-shyam-3)]",
];

/** Rectangular placeholder with the mandir motif inside the card. */
export function ProductArt({ name, seed, className }: { name: string; seed: number; className?: string; size?: "sm" | "md" }) {
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const initials = clean.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return (
    <div className={cn("@container relative flex h-full w-full items-end overflow-hidden p-[9%]", SWATCHES[seed % SWATCHES.length], className)} aria-hidden>
      <span className="arch absolute inset-x-[16%] top-[12%] -bottom-[4%] bg-[var(--arch)]" />
      {/* Small thumbnails show initials; anything wider than ~7rem shows the full name */}
      <span className="font-display relative w-full text-center text-[45cqw] leading-none @[7rem]:hidden">{initials}</span>
      <span className="font-display relative hidden text-[clamp(1.1rem,12cqw,2.1rem)] leading-[1.02] @[7rem]:block">{clean}</span>
    </div>
  );
}

export function Media({ src, alt, className, priority, poster }: { src: string; alt: string; className?: string; priority?: boolean; poster?: string }) {
  if (isVideo(src)) return <video src={src} className={className} muted loop playsInline autoPlay preload="metadata" aria-label={alt} poster={poster} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />;
}

export function Badge({ children, tone = "sky", className }: { children: React.ReactNode; tone?: "sky" | "gulal" | "haldi" | "mor" | "ink"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        tone === "sky" && "bg-paper text-ink-soft",
        tone === "gulal" && "bg-gulal text-white",
        tone === "haldi" && "bg-gold text-shyam",
        tone === "mor" && "bg-mor-soft text-mor",
        tone === "ink" && "bg-shyam text-on-shyam",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Container({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("wrap", className)} {...rest} />;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}
