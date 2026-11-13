"use client";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useRef, useState } from "react";
import { ProductArt } from "@/components/ui";
import { cn, isVideo } from "@/lib/utils";

/** Photos and videos for one product: swipe on phones, thumbnails and arrows on desktop. */
export function Gallery({ images, name, seed, arch }: { images: string[]; name: string; seed: number; arch?: boolean }) {
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const many = images.length > 1;

  const go = (n: number) => {
    const next = (n + images.length) % images.length;
    setI(next);
    const el = track.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  if (!images.length)
    return (
      <div className={cn(arch && "arch-frame mx-auto max-w-[520px] pt-2")}>
        <div className={cn("relative aspect-[4/5] overflow-hidden", arch ? "arch" : "rounded-[28px]")}>
          <ProductArt name={name} seed={seed} />
        </div>
      </div>
    );

  return (
    <div onKeyDown={(e) => (e.key === "ArrowRight" ? go(i + 1) : e.key === "ArrowLeft" ? go(i - 1) : null)}>
      <div className="relative">
        <div
          ref={track}
          className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto rounded-[28px] bg-paper-2"
          onScroll={(e) => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / el.clientWidth);
            if (n !== i) setI(n);
          }}
          aria-label={`${name}, ${images.length} photos and videos`}
          tabIndex={0}
        >
          {images.map((src, idx) =>
            isVideo(src) ? (
              <video key={src} src={src} className="h-full w-full shrink-0 snap-center object-cover" controls muted playsInline loop autoPlay={idx === 0} preload="metadata" aria-label={`${name} video`} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={idx === 0 ? name : `${name}, photo ${idx + 1}`} className="h-full w-full shrink-0 snap-center object-cover" loading={idx === 0 ? "eager" : "lazy"} fetchPriority={idx === 0 ? "high" : undefined} />
            ),
          )}
        </div>
        {many && (
          <>
            <button type="button" onClick={() => go(i - 1)} className="absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-lift hover:bg-paper md:grid" aria-label="Previous">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(i + 1)} className="absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-lift hover:bg-paper md:grid" aria-label="Next">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute right-4 bottom-4 rounded-full bg-shyam/80 px-2.5 py-1 text-xs text-white tabular-nums md:hidden">
              {i + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {many && (
        <div className="no-scrollbar mt-4 hidden gap-3 overflow-x-auto md:flex" role="tablist" aria-label="Photos and videos">
          {images.map((src, idx) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={idx === i}
              aria-label={`${isVideo(src) ? "Video" : "Photo"} ${idx + 1}`}
              onClick={() => go(idx)}
              className={cn("relative size-20 shrink-0 overflow-hidden rounded-2xl border-2 transition-colors duration-[var(--dur-short)]", idx === i ? "border-royal" : "border-transparent opacity-70 hover:opacity-100")}
            >
              {isVideo(src) ? (
                <>
                  <video src={`${src}#t=0.5`} className="h-full w-full object-cover" muted playsInline preload="metadata" aria-hidden />
                  <span className="absolute inset-0 grid place-items-center bg-shyam/30 text-white">
                    <Play className="size-6 fill-current" />
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
