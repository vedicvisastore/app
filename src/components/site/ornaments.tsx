/**
 * Colourful decorative pieces used sparingly across the store, in the same spirit as the brass hanging on the
 * home page: toran garland, corner rangoli and a peacock feather for empty states. (Small one-colour line glyphs for
 * section boundaries, lotus/feather/diya, live in ./ornament.tsx.) All are inline SVG (no requests), decorative
 * only (aria-hidden, no pointer events) and painted with theme tokens so every admin theme still applies.
 * Rule of thumb: at most one ornament per screen area, low contrast, never behind text people need to read.
 */
import { cn } from "@/lib/utils";
import "./ornaments.css";

type P = { className?: string };

/** Marigold-and-mango-leaf garland (bandhanwar) that hangs from the top edge of a band. Repeats to any width. */
export function Toran({ id, className }: P & { id: string }) {
  return (
    <svg className={cn("pointer-events-none block h-7 w-full", className)} aria-hidden focusable="false">
      <defs>
        <pattern id={id} width="56" height="28" patternUnits="userSpaceOnUse">
          {/* thread */}
          <path d="M0 3 Q14 11 28 3 T56 3" fill="none" stroke="var(--color-gold-ink)" strokeWidth="1" opacity="0.7" />
          {/* mango leaf */}
          <path d="M28 4 q-5 9 0 20 q5 -11 0 -20z" fill="var(--color-mor)" />
          <path d="M28 6 v15" stroke="var(--color-mor-deep)" strokeWidth="0.6" opacity="0.6" />
          {/* marigold */}
          <g transform="translate(14 13)">
            <circle r="5.5" fill="var(--color-gold)" />
            <circle r="5.5" fill="none" stroke="var(--color-gold-deep)" strokeWidth="1" strokeDasharray="2 1.4" />
            <circle r="2" fill="var(--color-gold-deep)" />
          </g>
          <g transform="translate(42 13)">
            <circle r="5.5" fill="var(--color-gulal)" opacity="0.85" />
            <circle r="5.5" fill="none" stroke="var(--color-gulal-deep)" strokeWidth="1" strokeDasharray="2 1.4" />
            <circle r="2" fill="var(--color-gold)" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Line rangoli / mandala. Uses currentColor: set colour and opacity on the parent (e.g. text-gold opacity-15). */
export function Rangoli({ className, spin }: P & { spin?: boolean }) {
  const petals = (n: number, r1: number, r2: number, w: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (360 / n) * i;
      return <path key={`${n}-${i}`} d={`M100 ${100 - r1} Q${100 + w} ${100 - (r1 + r2) / 2} 100 ${100 - r2} Q${100 - w} ${100 - (r1 + r2) / 2} 100 ${100 - r1}z`} transform={`rotate(${a} 100 100)`} />;
    });
  return (
    <svg viewBox="0 0 200 200" className={cn("pointer-events-none", spin && "vv-spin", className)} aria-hidden focusable="false" fill="none" stroke="currentColor" strokeWidth="1.1">
      <circle cx="100" cy="100" r="97" />
      <circle cx="100" cy="100" r="92" strokeDasharray="1 5" strokeLinecap="round" strokeWidth="2" />
      <g stroke="color-mix(in oklab, var(--color-gulal) 45%, white)" fill="color-mix(in oklab, var(--color-gulal) 10%, transparent)">{petals(16, 56, 90, 10)}</g>
      <g stroke="currentColor" fill="color-mix(in oklab, var(--color-gold) 12%, transparent)">{petals(8, 30, 56, 12)}</g>
      <circle cx="100" cy="100" r="30" stroke="color-mix(in oklab, var(--color-peacock) 50%, white)" />
      <g stroke="color-mix(in oklab, var(--color-peacock) 50%, white)">{petals(8, 8, 28, 6)}</g>
      <circle cx="100" cy="100" r="5" fill="currentColor" />
      {Array.from({ length: 16 }, (_, i) => {
        const a = ((360 / 16) * i + 11.25) * (Math.PI / 180);
        return <circle key={i} cx={100 + Math.sin(a) * 76} cy={100 - Math.cos(a) * 76} r="2" fill="currentColor" stroke="none" />;
      })}
    </svg>
  );
}

/** Peacock feather (Krishna's mor pankh) for empty states. */
export function PeacockFeather({ className, glint }: P & { glint?: boolean }) {
  // Fine barbs fanning out from the shaft, longest around the eye, shorter towards the quill.
  const barbs = Array.from({ length: 26 }, (_, i) => {
    const y = 18 + i * 6.2;
    const spread = i < 10 ? 34 + i * 0.4 : Math.max(6, 38 - (i - 10) * 2.1);
    const lift = 9 + spread * 0.25;
    return <path key={i} d={`M50 ${y} q${-spread * 0.5} ${-lift * 0.3} ${-spread} ${-lift} M50 ${y} q${spread * 0.5} ${-lift * 0.3} ${spread} ${-lift}`} />;
  });
  return (
    <svg viewBox="0 0 100 200" className={cn("pointer-events-none", className)} aria-hidden focusable="false">
      <g transform="rotate(-14 50 100)">
        <g fill="none" stroke="var(--color-mor)" strokeWidth="0.9" opacity="0.6" strokeLinecap="round">
          {barbs}
        </g>
        <path d="M50 196 C51 150 51 90 50 22" fill="none" stroke="var(--color-gold-ink)" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="50" cy="42" rx="25" ry="31" fill="var(--color-mor)" opacity="0.92" />
        <ellipse cx="50" cy="45" rx="18" ry="22" fill="var(--color-gold)" />
        <ellipse cx="50" cy="47" rx="12.5" ry="15.5" fill="var(--color-peacock)" />
        <ellipse cx="50" cy="50" rx="7" ry="9" fill="var(--color-shyam)" />
        <ellipse cx="47" cy="45" rx="2" ry="3" fill="var(--color-paper)" opacity="0.5" className={glint ? "vv-glint" : undefined} />
      </g>
    </svg>
  );
}
