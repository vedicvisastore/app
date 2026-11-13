"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Children, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useContent } from "@/components/site/content-context";

/** Each slide is the complete four-card hero, so every tile moves together. */
export function HeroSlider({ children, labels }: { children: ReactNode; labels: string[] }) {
  const c = useContent().home;
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const current = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const direction = useRef(1);
  const id = useId();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(true);
  const count = labels.length;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(preference.matches);
    const visibility = () => setHidden(document.hidden);
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    motion(); visibility();
    intersection.observe(root.current!);
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", motion);
    return () => {
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", motion);
    };
  }, [count]);

  const go = (next: number) => {
    current.current = Math.max(0, Math.min(count - 1, next));
    setIndex(current.current);
  };

  useEffect(() => {
    if (count < 2 || paused || hovered || reduced || hidden || !visible) return;
    const timer = window.setInterval(() => {
      if (current.current === count - 1) direction.current = -1;
      else if (current.current === 0) direction.current = 1;
      current.current += direction.current;
      setIndex(current.current);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [count, paused, hovered, reduced, hidden, visible]);

  return (
    <div ref={root} className="home-hero-slider" role="region" aria-roledescription="carousel" aria-label={c.heroSliderLabel}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={(event) => { if (!(event.target as HTMLElement).closest("[data-hero-playback]")) setPaused(true); }}>
      <div id={id} ref={viewport} className="home-hero-viewport" tabIndex={0}
        onPointerDown={(event) => {
          setPaused(true);
          swiped.current = false;
          pointer.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            swiped.current = true;
            go(current.current + (dx < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => { pointer.current = null; }}
        onClickCapture={(event) => { if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; } }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault(); setPaused(true);
            go(Math.max(0, Math.min(count - 1, index + (event.key === "ArrowRight" ? 1 : -1))));
          }
        }}>
        <div className="home-hero-track" style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}>
        {Children.map(children, (child, i) => <div className="home-hero-slide" role="group" aria-roledescription="slide" aria-label={labels[i]} aria-hidden={i !== index} inert={i !== index}>{child}</div>)}
        </div>
      </div>
      {count > 1 && <div className="home-hero-navigation">
        <div className="home-hero-categories">
          {labels.map((label, i) => <button key={label} type="button" aria-current={index === i ? "true" : undefined} aria-controls={id} onClick={() => { setPaused(true); go(i); }}>{label}</button>)}
        </div>
        <div className="home-hero-controls">
          <button type="button" disabled={index === 0} onClick={() => { setPaused(true); go(index - 1); }} aria-label={c.heroSliderPrevious} aria-controls={id}><ArrowLeft aria-hidden size={18} /></button>
          <button type="button" disabled={index === count - 1} onClick={() => { setPaused(true); go(index + 1); }} aria-label={c.heroSliderNext} aria-controls={id}><ArrowRight aria-hidden size={18} /></button>
        </div>
      </div>}
    </div>
  );
}
