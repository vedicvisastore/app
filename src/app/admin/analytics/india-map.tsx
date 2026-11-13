"use client";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inr } from "@/lib/utils";

export type Point = { pincode: string; lat: number | null; lng: number | null; orders: number; revenue: number; district: string; state: string };
type View = { lng: number; lat: number; span: number }; // centre and width in degrees of longitude

const INDIA: View = { lng: 82.4, lat: 22.4, span: 30 };
const STEPS = [1, 0.5, 0.25, 0.12, 0.06, 0.03];
const LAT_SCALE = 1 / Math.cos((22 * Math.PI) / 180); // keep cells square near India's middle latitude

function cellFor(span: number) {
  const target = span / 40;
  return STEPS.find((s) => s <= target) ?? STEPS[STEPS.length - 1];
}

/** A pixelated map of India: every square is a patch of land with post offices, shaded by its share of orders. */
export function IndiaPixelMap({ grid, points, total }: { grid: number[]; points: Point[]; total: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(INDIA);
  const [size, setSize] = useState({ w: 800, h: 820 });
  const [hover, setHover] = useState<{ x: number; y: number; key: string } | null>(null);
  const drag = useRef<{ x: number; y: number; v: View; moved: boolean } | null>(null);
  const cell = cellFor(view.span);

  // Land cells (from every pincode) and order cells at the current cell size
  const { land, heat, max } = useMemo(() => {
    const land = new Set<string>();
    for (let i = 0; i < grid.length; i += 2) land.add(`${Math.floor(grid[i + 1] / 100 / cell)},${Math.floor(grid[i] / 100 / cell)}`);
    const heat = new Map<string, { orders: number; revenue: number; places: Map<string, number> }>();
    for (const p of points) {
      if (p.lat == null || p.lng == null) continue;
      const k = `${Math.floor(p.lng / cell)},${Math.floor(p.lat / cell)}`;
      const e = heat.get(k) ?? { orders: 0, revenue: 0, places: new Map() };
      e.orders += p.orders;
      e.revenue += p.revenue;
      const place = `${p.district}, ${p.state}`;
      e.places.set(place, (e.places.get(place) ?? 0) + p.orders);
      heat.set(k, e);
      land.add(k);
    }
    let max = 0;
    for (const e of heat.values()) max = Math.max(max, e.orders);
    return { land, heat, max };
  }, [grid, points, cell]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      setSize({ w, h: Math.round(Math.min(Math.max(w * 1.02, 420), 860)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerDeg = size.w / view.span;
  const toScreen = useCallback(
    (lng: number, lat: number) => [(lng - view.lng) * pxPerDeg + size.w / 2, (view.lat - lat) * pxPerDeg * LAT_SCALE + size.h / 2] as const,
    [view, pxPerDeg, size],
  );
  const toGeo = useCallback(
    (x: number, y: number) => [view.lng + (x - size.w / 2) / pxPerDeg, view.lat - (y - size.h / 2) / (pxPerDeg * LAT_SCALE)] as const,
    [view, pxPerDeg, size],
  );

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const css = getComputedStyle(c);
    const scale = [1, 2, 3, 4, 5].map((n) => css.getPropertyValue(`--color-heat-${n}`).trim());
    const empty = css.getPropertyValue("--color-heat-0").trim();
    const ring = css.getPropertyValue("--color-ink").trim();
    const cw = cell * pxPerDeg;
    const ch = cell * pxPerDeg * LAT_SCALE;
    const gap = Math.max(1, Math.min(3, cw * 0.14));
    for (const k of land) {
      const [gx, gy] = k.split(",").map(Number);
      const [x, y] = toScreen(gx * cell, (gy + 1) * cell);
      if (x + cw < 0 || y + ch < 0 || x > size.w || y > size.h) continue;
      const h = heat.get(k);
      if (h) {
        // log scale so one big city doesn't wash out everyone else
        const t = max > 1 ? Math.log(h.orders) / Math.log(max) : 1;
        ctx.fillStyle = scale[Math.min(4, Math.floor(t * 4.999))];
      } else ctx.fillStyle = empty;
      ctx.beginPath();
      ctx.roundRect(x + gap / 2, y + gap / 2, cw - gap, ch - gap, Math.min(4, cw * 0.18));
      ctx.fill();
      if (hover?.key === k) {
        ctx.strokeStyle = ring;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [land, heat, max, cell, pxPerDeg, size, toScreen, hover]);

  const zoomAt = (factor: number, x = size.w / 2, y = size.h / 2) => {
    setView((v) => {
      const span = Math.min(40, Math.max(0.6, v.span / factor));
      const [lng, lat] = toGeo(x, y);
      // keep the point under the cursor where it is
      const k = span / v.span;
      return { span, lng: lng - (lng - v.lng) * k, lat: lat - (lat - v.lat) * k };
    });
  };

  // Wheel zooms the map instead of scrolling the page (needs a non-passive listener).
  const zoomRef = useRef(zoomAt);
  zoomRef.current = zoomAt;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoomRef.current(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, []);

  const keyAt = (x: number, y: number) => {
    const [lng, lat] = toGeo(x, y);
    const k = `${Math.floor(lng / cell)},${Math.floor(lat / cell)}`;
    return land.has(k) ? k : null;
  };

  const hovered = hover ? heat.get(hover.key) : undefined;
  const places = hovered ? [...hovered.places].sort((a, b) => b[1] - a[1]).slice(0, 3) : [];

  return (
    <div ref={wrap} className="relative w-full select-none">
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        className="block cursor-grab touch-none active:cursor-grabbing"
        role="img"
        aria-label={`Map of India showing ${total} orders by area`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, v: view, moved: false };
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const d = drag.current;
          if (d) {
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
            setView({ ...d.v, lng: d.v.lng - dx / pxPerDeg, lat: d.v.lat + dy / (pxPerDeg * LAT_SCALE) });
            return;
          }
          const k = keyAt(e.clientX - r.left, e.clientY - r.top);
          setHover(k ? { x: e.clientX - r.left, y: e.clientY - r.top, key: k } : null);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const r = e.currentTarget.getBoundingClientRect();
            zoomAt(2, e.clientX - r.left, e.clientY - r.top);
          }
        }}
        onPointerLeave={() => setHover(null)}
      />

      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-lift">
        <button type="button" onClick={() => zoomAt(1.6)} className="grid size-10 place-items-center hover:bg-sky" aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={() => zoomAt(0.625)} className="grid size-10 place-items-center border-t border-line hover:bg-sky" aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
        <button type="button" onClick={() => setView(INDIA)} className="grid size-10 place-items-center border-t border-line hover:bg-sky" aria-label="Show all of India">
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="absolute bottom-3 left-3 rounded-xl bg-paper/95 px-3 py-2 text-xs shadow-lift">
        <div className="flex items-center gap-1" aria-hidden>
          <span className="size-3 rounded-sm bg-heat-0" />
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="size-3 rounded-sm" style={{ background: `var(--color-heat-${n})` }} />
          ))}
        </div>
        <p className="mt-1 text-ink-soft">No orders to most orders. Each square is about ≈ {Math.round(cell * 111)} km</p>
      </div>

      {hover && (
        <div className="pointer-events-none absolute z-10 w-60 rounded-xl bg-shyam p-3 text-sm text-on-shyam shadow-float" style={{ left: Math.min(hover.x + 14, size.w - 250), top: Math.min(hover.y + 14, size.h - 120) }}>
          {hovered ? (
            <>
              <p className="font-bold">
                {hovered.orders} {hovered.orders === 1 ? "order" : "orders"}
                <span className="font-normal text-on-shyam-2">, {total ? Math.round((hovered.orders / total) * 1000) / 10 : 0}% of all</span>
              </p>
              <p className="text-on-shyam-2">{inr(hovered.revenue)}</p>
              <ul className="mt-1.5 space-y-0.5">
                {places.map(([name, n]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="truncate">{name}</span>
                    <span className="tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-on-shyam-2">No orders from here yet. Click to zoom in.</p>
          )}
        </div>
      )}
    </div>
  );
}
