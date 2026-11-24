"use client";
/**
 * The app's dropdown (store and admin). Replaces the browser's own <select>, whose open list can't be styled and
 * looked unfinished. The list opens in the browser's top layer (Popover API), so it sits above dialogs and isn't
 * clipped by scrolling panels. Keyboard: arrows, Home/End, Enter/Space, Esc, type to jump; long lists get a
 * search box. A hidden input keeps form features: `required`, `name` and address autofill (e.g. state).
 */
import { Check, ChevronDown, Search } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SelectOption<V extends string = string> = { value: V; label: string; disabled?: boolean };

type Props<V extends string> = {
  value: V | "";
  onChange: (value: V) => void;
  options: readonly SelectOption<V>[];
  /** Shown when nothing is chosen (value ""). */
  placeholder?: string;
  /** Trigger look: "field" = full-width form field, "pill" = rounded toolbar control, "compact" = small, for tables. */
  look?: "field" | "pill" | "compact";
  className?: string;
  /** Width of the open list when wider than the trigger. */
  menuMinWidth?: number;
  /** Search box in the list; on by default for lists longer than 10. */
  searchable?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

const LOOK = {
  field: "field flex items-center gap-2 text-left",
  pill: "flex h-10 items-center text-left gap-2 rounded-full border border-line-strong bg-paper pr-3 pl-4 text-base text-ink transition-colors hover:border-ink-soft sm:text-sm",
  compact: "flex h-8 items-center text-left gap-1.5 rounded-lg border border-line bg-paper pr-2 pl-2.5 text-sm text-ink transition-colors hover:border-ink-soft",
};

export function Select<V extends string>({ value, onChange, options, placeholder = "Choose…", look = "field", className, menuMinWidth = 0, searchable, id, name, required, disabled, autoComplete, ...aria }: Props<V>) {
  const uid = useId();
  const listId = `${uid}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const typed = useRef({ text: "", at: 0 });
  // Where the list lives: <body>, or the open modal <dialog> the trigger is in (outside it would be inert).
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(triggerRef.current?.closest("dialog") ?? document.body), []);

  const withSearch = searchable ?? options.length > 10;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const current = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, menuMinWidth), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 8;
    const above = r.top - 8;
    const want = 320;
    if (below >= Math.min(want, 200) || below >= above) setPos({ left, top: r.bottom + 4, width, maxHeight: Math.min(want, below - 4) });
    else setPos({ left, bottom: vh - r.top + 4, width, maxHeight: Math.min(want, above - 4) });
  }, [menuMinWidth]);

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const openList = () => {
    if (disabled) return;
    place();
    setOpen(true);
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : options.findIndex((o) => !o.disabled));
  };

  // Show in the top layer while open; follow the trigger on scroll/resize; close on a click outside.
  useLayoutEffect(() => {
    const p = popRef.current;
    if (!p) return;
    if (open && !p.matches(":popover-open")) p.showPopover?.();
    if (!open && p.matches(":popover-open")) p.hidePopover?.();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    (withSearch ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      place();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, withSearch, place, close]);

  // Keep the active option in view and valid for the filtered list.
  useEffect(() => {
    if (!open) return;
    if (active >= shown.length) setActive(shown.findIndex((o) => !o.disabled));
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, shown]);
  useEffect(() => {
    if (open) setActive(shown.findIndex((o) => !o.disabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (o: SelectOption<V> | undefined) => {
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  };

  const move = (from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < shown.length; i += step) if (!shown[i].disabled) return i;
    return from;
  };

  const onListKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => move(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => move(a, -1));
        break;
      case "Home":
        if (e.target === searchRef.current) return;
        e.preventDefault();
        setActive(move(-1, 1));
        break;
      case "End":
        if (e.target === searchRef.current) return;
        e.preventDefault();
        setActive(move(shown.length, -1));
        break;
      case "Enter":
        e.preventDefault();
        pick(shown[active]);
        break;
      case " ":
        if (e.target === searchRef.current) return;
        e.preventDefault();
        pick(shown[active]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation(); // don't also close a surrounding dialog
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (!withSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          const t = typed.current;
          t.text = now - t.at < 700 ? t.text + e.key.toLowerCase() : e.key.toLowerCase();
          t.at = now;
          const hit = (test: (l: string) => boolean) => shown.findIndex((o) => !o.disabled && test(o.label.toLowerCase()));
          let i = hit((l) => l.startsWith(t.text));
          if (i < 0) i = hit((l) => l.split(/[\s:/(]+/).some((w) => w.startsWith(t.text)));
          if (i >= 0) setActive(i);
        }
    }
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  return (
    <span className={cn("relative block min-w-0", look !== "field" && "inline-block")}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={cn(LOOK[look], "w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-55", open && look === "field" && "outline-[2.5px] outline-offset-[-1px] outline-[var(--color-focus)] outline-solid", className)}
      >
        <span className={cn("min-w-0 flex-1 truncate", !current && "text-ink-soft")}>{current ? current.label : placeholder}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-soft transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      {/* Keeps native form behaviour: required check, form data and browser autofill. */}
      {(name || required || autoComplete) && (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim().toLowerCase();
            const o = options.find((x) => x.value.toLowerCase() === v || x.label.toLowerCase() === v);
            if (o && !o.disabled) onChange(o.value);
          }}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        />
      )}
      {/* In <body>, not inside the trigger's <label>: a click on an option inside a label would re-click the trigger. */}
      {host && createPortal(<div
        ref={popRef}
        popover="manual"
        onKeyDown={onListKey}
        style={pos ? { left: pos.left, top: pos.top ?? "auto", bottom: pos.bottom ?? "auto", width: pos.width } : undefined}
        className="fixed m-0 overflow-hidden rounded-xl border border-line bg-paper p-0 text-ink shadow-[0_12px_32px_-8px_rgb(0_0_0/0.22),0_2px_6px_rgb(0_0_0/0.06)]"
      >
        {withSearch && (
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search the list"
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${uid}-o${active}` : undefined}
              className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
            />
          </div>
        )}
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={active >= 0 ? `${uid}-o${active}` : undefined}
          style={{ maxHeight: pos ? pos.maxHeight - (withSearch ? 41 : 0) : 320 }}
          className="overflow-y-auto overscroll-contain p-1 outline-none"
        >
          {shown.map((o, i) => {
            const sel = o.value === value;
            return (
              <li
                key={o.value || "__empty"}
                id={`${uid}-o${i}`}
                data-i={i}
                role="option"
                aria-selected={sel}
                aria-disabled={o.disabled || undefined}
                onPointerMove={() => !o.disabled && active !== i && setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-base sm:text-sm",
                  i === active && "bg-paper-2",
                  sel && "font-semibold",
                  o.disabled && "cursor-not-allowed opacity-45",
                )}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {sel && <Check className="size-4 shrink-0 text-royal" aria-hidden />}
              </li>
            );
          })}
          {!shown.length && <li className="px-3 py-2 text-sm text-ink-soft">Nothing matches “{query}”</li>}
        </ul>
      </div>, host)}
    </span>
  );
}
