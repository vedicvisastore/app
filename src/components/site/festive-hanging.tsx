"use client";

import { useEffect, useRef } from "react";

/** Decorative only: never intercepts the storefront's links or touch gestures. */
export function FestiveHanging() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current!;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dispose: (() => void) | undefined;
    let generation = 0;
    const update = async () => {
      const current = ++generation;
      dispose?.();
      dispose = undefined;
      delete element.dataset.ready;
      if (!desktop.matches || reduced.matches) return;
      try {
        const { mountHanging } = await import("./festive-hanging-scene");
        if (current !== generation) return;
        dispose = mountHanging(element);
      } catch {
        // The small inline illustration remains if WebGL or the chunk is unavailable.
      }
    };
    void update();
    desktop.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      generation++;
      desktop.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
      dispose?.();
    };
  }, []);

  return (
    <div ref={host} className="festive-hanging" aria-hidden="true">
      <svg className="festive-hanging-fallback" viewBox="0 0 170 470" fill="none">
        <defs>
          <linearGradient id="hanging-brass"><stop stopColor="#946122" /><stop offset=".45" stopColor="#efc36c" /><stop offset="1" stopColor="#b28338" /></linearGradient>
        </defs>
        {[{ x: 50, end: 252 }, { x: 87, end: 362 }, { x: 120, end: 290 }].map(({ x, end }) => (
          <g key={x}>
            <path d={`M${x} 0V${end}`} stroke="#b28338" strokeWidth="1.6" />
            {[60, 83, 106, end - 59, end - 36].map((y, i) => <g key={y} transform={`translate(${x} ${y})`}>
              {Array.from({ length: 8 }, (_, n) => <ellipse key={n} rx="5" ry="10" fill={i % 2 ? "#e8a72f" : "#edb94c"} transform={`rotate(${n * 45})`} />)}
              <circle r="5" fill="#be7920" />
            </g>)}
            <path d={`M${x} 128q-23 8-10 35q17-10 10-35 M${x} 153q23 8 10 35q-17-10-10-35`} fill="#327965" />
            <path d={`M${x - 5} ${end}q0-8 5-8q5 0 5 8l4 17h-18z`} fill="url(#hanging-brass)" />
            <ellipse cx={x} cy={end + 17} rx="12" ry="4" fill="url(#hanging-brass)" />
            <path d={`M${x} ${end + 17}v10`} stroke="#946122" strokeWidth="2" />
            <circle cx={x} cy={end + 28} r="3" fill="#b28338" />
          </g>
        ))}
      </svg>
    </div>
  );
}
