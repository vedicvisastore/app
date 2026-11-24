"use client";
import { RotateCcw, X } from "lucide-react";
import {
  BLOCK_PROP_LABEL,
  BLOCKS,
  COLOR_ROLES,
  FONT_ROLES,
  FONTS,
  LOOK,
  type BlockKey,
  type BlockProp,
  type BlockStyle,
  type ColorToken,
  type Design,
  type FontKey,
  type LookKey,
} from "@/lib/design";
import { cn } from "@/lib/utils";

/** Every selectable Google font in one stylesheet, so the font menus can show each font in itself. */
export const ALL_FONTS_HREF = `https://fonts.googleapis.com/css2?${Object.values(FONTS)
  .map((f) => ("google" in f ? `family=${f.google}` : ""))
  .filter(Boolean)
  .join("&")}&display=swap`;

export type PickedBlock = { key: BlockKey; count: number; colors: { bg?: string; text?: string; heading?: string } };

type SetDesign = (fn: (d: Design) => Design) => void;

const FONT_KEYS = Object.keys(FONTS) as FontKey[];

// ── Whole-store design ──────────────────────────────────────
export function DesignPanel({ design, setDesign, tokens, onClose }: { design: Design; setDesign: SetDesign; tokens: Record<string, string>; onClose: () => void }) {
  const setColor = (t: ColorToken, v: string | null) =>
    setDesign((d) => {
      const colors = { ...d.colors };
      if (v) colors[t] = v;
      else delete colors[t];
      return { ...d, colors };
    });
  const setFont = (role: "display" | "body", v: FontKey | null) =>
    setDesign((d) => {
      const fonts = { ...d.fonts };
      if (v) fonts[role] = v;
      else delete fonts[role];
      return { ...d, fonts };
    });
  const setLook = (k: LookKey, v: string) => setDesign((d) => ({ ...d, look: { ...d.look, [k]: v } }));
  const anything = Object.keys(design.colors ?? {}).length + Object.keys(design.fonts ?? {}).length + Object.keys(design.look ?? {}).length > 0;

  return (
    <div className="p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-display text-xl">Design</p>
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sky xl:hidden" aria-label="Close design">
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-5 text-xs text-ink-soft">For the whole store. Every place that uses a colour or font changes with it. To change one part only, switch to Style and tap it.</p>

      <Section title="Colours">
        <ul className="space-y-2">
          {COLOR_ROLES.map((r) => {
            const own = design.colors?.[r.token];
            const value = own ?? tokens[r.token] ?? "#000000";
            return (
              <li key={r.token} className="flex items-center gap-3">
                <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line shadow-lift" style={{ background: value }}>
                  <input type="color" value={value} onChange={(e) => setColor(r.token, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={r.label} />
                </label>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{r.label}</span>
                  <span className="block truncate text-xs text-ink-mute">{r.hint}</span>
                </span>
                {own && <ResetBtn label={`Reset ${r.label}`} onClick={() => setColor(r.token, null)} />}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-ink-mute">Lighter and darker shades of each colour follow it automatically. Choosing a new theme in Themes clears these.</p>
      </Section>

      <Section title="Fonts">
        <div className="space-y-4">
          {FONT_ROLES.map((r) => {
            const cur = design.fonts?.[r.role] ?? (r.fallback as FontKey);
            return (
              <div key={r.role}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold">{r.label}</span>
                  {design.fonts?.[r.role] && <ResetBtn label={`Reset ${r.label}`} onClick={() => setFont(r.role, null)} />}
                </div>
                <FontSelect value={cur} onChange={(v) => setFont(r.role, v === r.fallback ? null : v)} />
                <p className="mt-1.5 truncate rounded-lg bg-paper-2 px-3 py-2 text-lg" style={{ fontFamily: FONTS[cur].stack.replace("var(--font-rozha), ", "") }}>
                  Bhakti Box भक्ति ₹1,500
                </p>
                <p className="mt-1 text-[11px] text-ink-mute">{r.hint}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Look">
        <div className="space-y-4">
          {(Object.keys(LOOK) as LookKey[]).map((k) => {
            const opts = LOOK[k].options as Record<string, string>;
            const cur = (design.look?.[k] as string | undefined) ?? LOOK[k].default;
            return (
              <div key={k}>
                <p className="text-sm font-bold">{LOOK[k].label}</p>
                <p className="mb-1.5 text-[11px] text-ink-mute">{LOOK[k].hint}</p>
                <div className="flex rounded-full bg-sky p-0.5" role="radiogroup" aria-label={LOOK[k].label}>
                  {Object.entries(opts).map(([v, label]) => (
                    <button key={v} type="button" role="radio" aria-checked={cur === v} onClick={() => setLook(k, v)} className={cn("h-8 flex-1 rounded-full px-2 text-xs font-bold", cur === v ? "bg-paper text-ink shadow-lift" : "text-ink-soft")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {anything && (
        <button type="button" onClick={() => setDesign((d) => ({ blocks: d.blocks }))} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-royal">
          <RotateCcw className="size-3.5" aria-hidden /> Reset colours, fonts and look to the theme
        </button>
      )}
    </div>
  );
}

// ── One part of the page ─────────────────────────────────────
export function BlockPanel({ block, design, setDesign, onClose }: { block: PickedBlock; design: Design; setDesign: SetDesign; onClose: () => void }) {
  const def = BLOCKS[block.key];
  const style: BlockStyle = design.blocks?.[block.key] ?? {};
  const set = (p: BlockProp, v: string | number | null) =>
    setDesign((d) => {
      const s: BlockStyle = { ...(d.blocks?.[block.key] ?? {}) };
      if (v === null || v === "") delete (s as Record<string, unknown>)[p];
      else (s as Record<string, unknown>)[p] = v;
      const blocks = { ...d.blocks, [block.key]: s };
      if (!Object.keys(s).length) delete blocks[block.key];
      return { ...d, blocks };
    });
  const props = def.props as readonly BlockProp[];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-[0.06em] text-ink-mute uppercase">Style · {def.group}</p>
          <p className="font-bold">{def.label}</p>
        </div>
        <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sky" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <p className={cn("mb-4 rounded-xl px-3 py-2 text-sm", "repeat" in def ? "bg-gold-soft text-gold-ink" : "bg-sky text-ink-soft")}>
        {"repeat" in def ? `Changes ${def.repeat} at once (${block.count} on this page).` : "Changes this part only."}
      </p>

      <div className="space-y-4">
        {props.map((p) => {
          if (p === "bg" || p === "text" || p === "heading") {
            const own = style[p];
            const value = own ?? (p === "bg" ? block.colors.bg : p === "text" ? block.colors.text : block.colors.heading) ?? "#000000";
            return (
              <div key={p} className="flex items-center gap-3">
                <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line shadow-lift" style={{ background: value }}>
                  <input type="color" value={value} onChange={(e) => set(p, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={BLOCK_PROP_LABEL[p]} />
                </label>
                <span className="flex-1">
                  <span className="block text-sm font-bold">{BLOCK_PROP_LABEL[p]}</span>
                  <span className="text-xs text-ink-mute">{own ? own.toUpperCase() : "From the theme"}</span>
                </span>
                {own && <ResetBtn label={`Reset ${BLOCK_PROP_LABEL[p]}`} onClick={() => set(p, null)} />}
              </div>
            );
          }
          if (p === "headingFont" || p === "bodyFont") {
            const own = style[p];
            return (
              <div key={p}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold">{BLOCK_PROP_LABEL[p]}</span>
                  {own && <ResetBtn label={`Reset ${BLOCK_PROP_LABEL[p]}`} onClick={() => set(p, null)} />}
                </div>
                <FontSelect value={own ?? null} placeholder="Same as the whole store" onChange={(v) => set(p, v)} />
              </div>
            );
          }
          const own = style.radius;
          return (
            <div key={p}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold">{BLOCK_PROP_LABEL[p]}</span>
                {own !== undefined && <ResetBtn label="Reset corners" onClick={() => set("radius", null)} />}
              </div>
              <input type="range" min={0} max={40} value={own ?? 14} onChange={(e) => set("radius", Number(e.target.value))} className="w-full accent-[var(--color-royal)]" aria-label={BLOCK_PROP_LABEL[p]} />
              <p className="text-xs text-ink-mute">{own === undefined ? "From the overall look" : `${own}px`}</p>
            </div>
          );
        })}
      </div>

      {Object.keys(style).length > 0 && (
        <button type="button" onClick={() => props.forEach((p) => set(p, null))} className="mt-5 inline-flex items-center gap-1 self-start text-xs font-bold text-royal">
          <RotateCcw className="size-3.5" aria-hidden /> Reset this part
        </button>
      )}
    </div>
  );
}

function FontSelect({ value, onChange, placeholder }: { value: FontKey | null; onChange: (v: FontKey | null) => void; placeholder?: string }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as FontKey | null)} className="field h-10 !py-1 text-base sm:text-sm">
      {placeholder && <option value="">{placeholder}</option>}
      {FONT_KEYS.map((k) => (
        <option key={k} value={k}>
          {FONTS[k].label}
          {"devanagari" in FONTS[k] && FONTS[k].devanagari ? " · हिन्दी" : ""}
        </option>
      ))}
    </select>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 border-t border-line pt-4">
      <p className="mb-3 text-[0.7rem] font-bold tracking-[0.12em] text-gulal uppercase">{title}</p>
      {children}
    </section>
  );
}

function ResetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sky hover:text-royal" aria-label={label} title={label}>
      <RotateCcw className="size-3.5" />
    </button>
  );
}
