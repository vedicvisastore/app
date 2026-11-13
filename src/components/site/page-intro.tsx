import { Container } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Rangoli } from "./ornaments";

/** Dark title band used at the top of listing pages (shop, deals, new launches, festivals). */
export function PageIntro({ title, lede, eyebrow, className, children }: { title: string; lede?: string; eyebrow?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("on-dark relative overflow-hidden", className)}>
      <Rangoli spin className="absolute -top-28 -right-28 size-72 text-gold opacity-[0.12] sm:size-96" />
      <Container className="relative grid items-end gap-6 py-12 sm:py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-7">
          {eyebrow && <div className="mb-3 text-sm text-on-shyam-2">{eyebrow}</div>}
          <h1 className="text-[length:var(--text-display-s)] text-on-shyam">{title}</h1>
        </div>
        {(lede || children) && (
          <div className="lg:col-span-4 lg:col-start-9">
            {lede && <p className="lead text-on-shyam-2">{lede}</p>}
            {children}
          </div>
        )}
      </Container>
    </div>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-12 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <h2 className="text-[length:clamp(1.75rem,2vw+1rem,2.5rem)]">{children}</h2>
      {aside}
    </div>
  );
}
