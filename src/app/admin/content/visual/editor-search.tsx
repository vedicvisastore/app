"use client";
import { Boxes, Image as ImageIcon, LayoutTemplate, Palette, Type, TypeOutline } from "lucide-react";
import { IMAGE_SLOTS } from "@/content/images";
import { BLOCKS, COLOR_ROLES, FONT_ROLES, LOOK } from "@/lib/design";
import { searchScore } from "@/lib/search";

export type Tab = "text" | "pictures" | "colours" | "fonts" | "look" | "parts";
export const TABS: { key: Tab; label: string; icon: typeof Type }[] = [
  { key: "text", label: "Text", icon: Type },
  { key: "pictures", label: "Pictures", icon: ImageIcon },
  { key: "colours", label: "Colours", icon: Palette },
  { key: "fonts", label: "Fonts", icon: TypeOutline },
  { key: "look", label: "Look", icon: LayoutTemplate },
  { key: "parts", label: "Parts", icon: Boxes },
];

type Kind = "text" | "picture" | "colours" | "fonts" | "look" | "part";
export type IndexItem = { kind: Kind; key: string; title: string; detail: string; where: string };

const KIND: Record<Kind, { label: string; icon: typeof Type }> = {
  text: { label: "Text", icon: Type },
  picture: { label: "Picture", icon: ImageIcon },
  colours: { label: "Colour", icon: Palette },
  fonts: { label: "Font", icon: TypeOutline },
  look: { label: "Look", icon: LayoutTemplate },
  part: { label: "Part", icon: Boxes },
};

/** Everything the editor can change, as one searchable list. */
export function buildIndex(fields: { key: string; label: string; value: string; groupLabel: string }[], edits: Record<string, string>): IndexItem[] {
  return [
    ...fields.map((f) => ({ kind: "text" as const, key: f.key, title: f.label, detail: edits[f.key] || f.value, where: f.groupLabel })),
    ...Object.entries(IMAGE_SLOTS).map(([k, s]) => ({ kind: "picture" as const, key: k, title: s.label, detail: s.where, where: "Pictures" })),
    ...COLOR_ROLES.map((r) => ({ kind: "colours" as const, key: r.token, title: r.label, detail: r.hint, where: "Colours colour" })),
    ...FONT_ROLES.map((r) => ({ kind: "fonts" as const, key: r.role, title: r.label, detail: r.hint, where: "Fonts font typeface" })),
    ...Object.entries(LOOK).map(([k, l]) => ({ kind: "look" as const, key: k, title: l.label, detail: `${l.hint} ${Object.values(l.options).join(" ")}`, where: "Look" })),
    ...Object.entries(BLOCKS).map(([k, b]) => ({ kind: "part" as const, key: k, title: b.label, detail: b.group, where: "Parts section style background" })),
  ];
}

/** Forgiving search over the index (typos, half words), best matches first. */
export function SearchResults({ items, q, onPick }: { items: IndexItem[]; q: string; onPick: (it: IndexItem) => void }) {
  const hits = items
    .map((it) => ({ it, s: searchScore(q, { name: it.title, tagline: it.detail, categoryName: it.where, bundleGroup: KIND[it.kind].label }) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 40);
  if (!hits.length) return <p className="py-6 text-center text-sm text-ink-mute">Nothing matches “{q}”.</p>;
  return (
    <ul className="space-y-0.5">
      {hits.map(({ it }) => {
        const K = KIND[it.kind];
        return (
          <li key={`${it.kind}:${it.key}`}>
            <button type="button" onClick={() => onPick(it)} className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-sky">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-sky text-royal">
                <K.icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{it.title}</span>
                <span className="block truncate text-xs text-ink-soft">{it.detail}</span>
              </span>
              <span className="mt-0.5 shrink-0 text-[0.65rem] font-bold tracking-wider text-ink-mute uppercase">{K.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
