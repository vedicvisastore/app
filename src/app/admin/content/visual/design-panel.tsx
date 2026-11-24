"use client";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BLOCK_PROP_LABEL,
  BLOCKS,
  COLOR_ROLES,
  FONT_ROLES,
  FONT_KINDS,
  FONT_LANGS,
  FONTS,
  LOOK,
  type BlockKey,
  type BlockProp,
  type BlockStyle,
  type ColorToken,
  type Design,
  type FontKey,
  type FontKind,
  type LookKey,
} from "@/lib/design";
import { cn } from "@/lib/utils";

/** Every selectable Google font in one stylesheet, so the font menus can show each font in itself. */
export const ALL_FONTS_HREF = `https://fonts.googleapis.com/css2?${Object.values(FONTS)
  .map((f) => ("google" in f ? `family=${f.google}` : ""))
  .filter(Boolean)
  .join("&")}&display=swap`;

export type PickedBlock = { key: BlockKey; count: number | null; colors: { bg?: string; text?: string; heading?: string } };

type SetDesign = (fn: (d: Design) => Design) => void;

const FONT_KEYS = Object.keys(FONTS) as FontKey[];

// ── Whole-store design, one section at a time (Colours / Fonts / Look tabs) ──
export type DesignPart = "colours" | "fonts" | "look";

export function DesignSection({ part, design, setDesign, tokens, focus, onPart }: { part: DesignPart; design: Design; setDesign: SetDesign; tokens: Record<string, string>; focus?: string | null; onPart: (key: BlockKey) => void }) {
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
  // A search result opens its tab and points at the matching row.
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`vv-row-${focus}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.animate([{ backgroundColor: "color-mix(in oklab, var(--color-gold) 35%, transparent)" }, { backgroundColor: "transparent" }], { duration: 1400 });
  }, [focus, part]);

  if (part === "colours")
    return (
      <div>
        <p className="mb-3 text-xs text-ink-soft">The whole store uses these. Lighter and darker shades follow each one. Choosing a new theme in Themes clears them.</p>
        <ul className="space-y-1">
          {COLOR_ROLES.map((r) => {
            const own = design.colors?.[r.token];
            const value = own ?? tokens[r.token] ?? "#000000";
            return (
              <li key={r.token} id={`vv-row-${r.token}`} className="flex items-center gap-3 rounded-xl p-1.5">
                <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line shadow-lift" style={{ background: value }}>
                  <input type="color" value={value} onChange={(e) => setColor(r.token, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={r.label} />
                </label>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{r.label}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <HexInput value={value} onChange={(v) => setColor(r.token, v)} label={r.label} />
                    <span className="min-w-0 truncate text-xs text-ink-mute" title={r.hint}>{r.hint}</span>
                  </span>
                </span>
                {own && <ResetBtn label={`Reset ${r.label}`} onClick={() => setColor(r.token, null)} />}
              </li>
            );
          })}
        </ul>
        {Object.keys(design.colors ?? {}).length > 0 && (
          <button type="button" onClick={() => setDesign((d) => ({ ...d, colors: {} }))} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-royal">
            <RotateCcw className="size-3.5" aria-hidden /> All colours back to the theme
          </button>
        )}
      </div>
    );

  if (part === "fonts") {
    const usage = fontUsage(design);
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <p className="text-xs text-ink-soft">The two fonts of the whole store. The list is grouped by language (fonts with Hindi letters first), then by style.</p>
          {FONT_ROLES.map((r) => {
            const cur = design.fonts?.[r.role] ?? (r.fallback as FontKey);
            return (
              <div key={r.role} id={`vv-row-${r.role}`} className="rounded-xl p-1.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold">{r.label}</span>
                  {design.fonts?.[r.role] && <ResetBtn label={`Reset ${r.label}`} onClick={() => setFont(r.role, null)} />}
                </div>
                <FontSelect value={cur} onChange={(v) => setFont(r.role, v === r.fallback ? null : v)} />
                <p className="mt-1 text-[11px] text-ink-mute">{r.hint}</p>
              </div>
            );
          })}
        </div>

        {/* Every font on the store right now, and exactly where: tap a place to go to it */}
        <div>
          <p className="mb-2 text-[0.68rem] font-bold tracking-[0.12em] text-ink-mute uppercase">Fonts in use ({usage.length})</p>
          <ul className="space-y-3">
            {usage.map((u) => (
              <li key={u.font} className="rounded-2xl border border-line p-3">
                <p className="truncate text-2xl leading-tight" style={{ fontFamily: FONTS[u.font].stack.replace("var(--font-rozha), ", "") }}>
                  {FONTS[u.font].label.replace(" (current)", "")}
                </p>
                <p className="truncate text-sm text-ink-soft" style={{ fontFamily: FONTS[u.font].stack.replace("var(--font-rozha), ", "") }}>
                  Bhakti Box भक्ति ₹1,500
                </p>
                <p className="mt-2 text-[0.68rem] font-bold tracking-wider text-ink-mute uppercase">Used for</p>
                <ul className="mt-1 space-y-1">
                  {u.roles.map((r) => (
                    <li key={r} className="text-sm">{r}</li>
                  ))}
                  {u.parts.map((p) => (
                    <li key={`${p.key}-${p.what}`}>
                      <button type="button" onClick={() => onPart(p.key)} className="flex w-full items-center gap-2 rounded-lg bg-paper-2 px-2.5 py-1.5 text-left text-sm hover:bg-sky">
                        <span className="flex-1">
                          <b>{BLOCKS[p.key].label}</b> <span className="text-ink-soft">· {p.what}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-royal" aria-label="Go there" />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(Object.keys(LOOK) as LookKey[]).map((k) => {
        const opts = LOOK[k].options as Record<string, string>;
        const cur = (design.look?.[k] as string | undefined) ?? LOOK[k].default;
        return (
          <div key={k} id={`vv-row-${k}`} className="rounded-xl p-1.5">
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
  );
}

/** Every styleable part, grouped, for the Parts tab (tapping one in the preview does the same). */
export function PartsList({ design, onPick }: { design: Design; onPick: (key: BlockKey) => void }) {
  const keys = Object.keys(BLOCKS) as BlockKey[];
  const groups = [...new Set(keys.map((k) => BLOCKS[k].group))];
  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-soft">Restyle one part of the store. Cards and buttons change together. You can also switch to Style and tap a part in the preview.</p>
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-[0.68rem] font-bold tracking-[0.12em] text-ink-mute uppercase">{g}</p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {keys
              .filter((k) => BLOCKS[k].group === g)
              .map((k) => (
                <li key={k}>
                  <button type="button" onClick={() => onPick(k)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-sky/50">
                    <span className="flex-1">{BLOCKS[k].label}</span>
                    {design.blocks?.[k] && <span className="size-2 rounded-full bg-gulal" aria-label="Changed" />}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
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
      <DetailHeader eyebrow={`Style · ${def.group}`} title={def.label} onBack={onClose} />
      <p className={cn("mb-4 rounded-xl px-3 py-2 text-sm", "repeat" in def ? "bg-gold-soft text-gold-ink" : "bg-sky text-ink-soft")}>
        {"repeat" in def ? `Changes ${def.repeat} at once${block.count ? ` (${block.count} on this page)` : ""}.` : "Changes this part only."}
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
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{BLOCK_PROP_LABEL[p]}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <HexInput value={value} onChange={(v) => set(p, v)} label={BLOCK_PROP_LABEL[p]} />
                    {!own && <span className="text-xs text-ink-mute">From the theme</span>}
                  </span>
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
  // Grouped by language first (fonts with Hindi letters, then English-only), then by style.
  const groups = (Object.keys(FONT_LANGS) as (keyof typeof FONT_LANGS)[]).flatMap((lang) =>
    (Object.keys(FONT_KINDS) as FontKind[])
      .map((kind) => ({ label: `${FONT_LANGS[lang]} · ${FONT_KINDS[kind]}`, keys: FONT_KEYS.filter((k) => FONTS[k].lang === lang && FONTS[k].kind === kind) }))
      .filter((g) => g.keys.length),
  );
  return (
    <select value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as FontKey | null)} className="field h-10 !py-1 text-base sm:text-sm">
      {placeholder && <option value="">{placeholder}</option>}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.keys.map((k) => {
            const f: { label: string; stack: string; hi?: string } = FONTS[k];
            // Fonts with Hindi letters show their name in Hindi too; each option is drawn in its own font where the browser allows.
            return (
              <option key={k} value={k} style={{ fontFamily: f.stack.replace("var(--font-rozha), ", "") }}>
                {f.hi ? `${f.label} · ${f.hi}` : f.label}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}

function ResetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sky hover:text-royal" aria-label={label} title={label}>
      <RotateCcw className="size-3.5" />
    </button>
  );
}

/**
 * Type or paste a colour code. Accepts "#a1b2c3", "a1b2c3" or the short "#abc"; applies as soon as it is a full
 * colour, and goes back to the current colour if left half-typed.
 */
function HexInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [text, setText] = useState(value.toUpperCase());
  useEffect(() => setText(value.toUpperCase()), [value]);
  const parse = (raw: string) => {
    const t = raw.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(t)) return `#${t.toLowerCase()}`;
    if (/^[0-9a-f]{3}$/i.test(t)) return `#${[...t].map((c) => c + c).join("").toLowerCase()}`;
    return null;
  };
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parse(e.target.value);
        if (v && e.target.value.replace(/^#/, "").length === 6) onChange(v);
      }}
      onBlur={() => {
        const v = parse(text);
        if (v) onChange(v);
        else setText(value.toUpperCase());
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      spellCheck={false}
      maxLength={7}
      aria-label={`${label} colour code`}
      className="h-7 w-[5.6rem] shrink-0 rounded-md border border-line bg-paper px-1.5 font-mono text-base uppercase tracking-wide outline-none focus:border-royal sm:text-xs"
    />
  );
}

/** Top of a detail view inside the editor panel: back to the list, what is being edited. */
export function DetailHeader({ eyebrow, title, onBack }: { eyebrow: string; title: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-2">
      <button type="button" onClick={onBack} className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sky" aria-label="Back">
        <ArrowLeft className="size-4" />
      </button>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-bold tracking-[0.1em] text-ink-mute uppercase">{eyebrow}</p>
        <p className="font-bold leading-snug">{title}</p>
      </div>
    </div>
  );
}

/** Each font the store uses: the whole-store roles it fills and every part that picked it on its own. */
function fontUsage(design: Design) {
  const map = new Map<FontKey, { font: FontKey; roles: string[]; parts: { key: BlockKey; what: string }[] }>();
  const at = (f: FontKey) => map.get(f) ?? map.set(f, { font: f, roles: [], parts: [] }).get(f)!;
  at(design.fonts?.display ?? "rozha").roles.push("Headings across the whole store");
  at(design.fonts?.body ?? "satoshi").roles.push("Text, buttons and menus across the whole store");
  for (const [k, s] of Object.entries(design.blocks ?? {}) as [BlockKey, BlockStyle][]) {
    if (s.headingFont) at(s.headingFont).parts.push({ key: k, what: "headings" });
    if (s.bodyFont) at(s.bodyFont).parts.push({ key: k, what: "text" });
  }
  return [...map.values()];
}
