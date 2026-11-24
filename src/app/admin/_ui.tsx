"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl leading-tight sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-paper shadow-[0_1px_2px_rgb(16_24_40/0.04)]", className)} {...rest} />;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "royal" | "mor" | "gulal" | "haldi" }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", tone === "mor" && "text-mor", tone === "gulal" && "text-gulal", tone === "royal" && "text-royal", tone === "haldi" && "text-gold-ink")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </Card>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

/** Edits a paise value as rupees. */
export function MoneyInput({ value, onChange, allowEmpty, className, ...rest }: { value: number | null; onChange: (paise: number | null) => void; allowEmpty?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value == null ? "" : String(value / 100));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setText(value == null ? "" : String(value / 100));
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-mute">₹</span>
      <input
        inputMode="decimal"
        className={cn("field pl-7 tabular-nums", className)}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          setText(t);
          const n = parseFloat(t);
          const next = t === "" ? (allowEmpty ? null : 0) : Number.isFinite(n) ? Math.round(n * 100) : 0;
          setLast(next);
          onChange(next);
        }}
        {...rest}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm">
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-mor" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-paper shadow transition-transform", checked ? "left-0.5 translate-x-4" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-bold transition-colors", value === it.value ? "border-royal text-royal" : "border-transparent text-ink-soft hover:text-ink")}
        >
          {it.label}
          {it.count != null && <span className="ml-1.5 rounded-full bg-sky px-1.5 text-xs text-ink-soft">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const th = "px-3 py-2.5 text-left text-xs font-bold text-ink-soft whitespace-nowrap";
export const td = "px-3 py-3 align-middle";

// ── Toasts ────────────────────────────────────────────
type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn("rounded-xl px-4 py-3 text-sm font-bold text-white shadow-float", t.tone === "ok" ? "bg-ink" : "bg-gulal")}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Inline two-step confirm, since the browser confirm() dialog is avoided. */
export function ConfirmButton({ onConfirm, children, confirmLabel = "Confirm", className, disabled }: { onConfirm: () => void; children: React.ReactNode; confirmLabel?: string; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  if (armed)
    return (
      <span className="inline-flex items-center gap-1">
        <button type="button" onClick={() => { setArmed(false); onConfirm(); }} className="rounded-full bg-gulal px-3 py-1 text-xs font-bold text-white">
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setArmed(false)} className="rounded-full px-2 py-1 text-xs font-bold text-ink-soft">
          Keep
        </button>
      </span>
    );
  return (
    <button type="button" disabled={disabled} onClick={() => setArmed(true)} className={className}>
      {children}
    </button>
  );
}

export function NumberCell({ value, onSave, placeholder, width = "w-16" }: { value: number | null; onSave: (v: number | null) => void; placeholder?: string; width?: string }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setV(value == null ? "" : String(value));
  }
  const commit = () => {
    const n = v.trim() === "" ? null : Math.max(0, Math.round(Number(v)));
    if (n !== value && (n === null || Number.isFinite(n))) onSave(n);
  };
  return (
    <input
      value={v}
      inputMode="numeric"
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value.replace(/[^\d-]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-8 rounded-lg border border-transparent bg-sky/60 px-2 text-sm tabular-nums outline-none hover:border-line-strong focus:border-royal focus:bg-paper", width)}
    />
  );
}


// ── Paging ──────────────────────────────────────────────
export const PAGE_SIZES = [25, 50, 100] as const;

/** Page numbers to show: first, last, and two either side of the current one, with gaps as null. */
function pageList(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  if (page <= 3) [2, 3, 4].forEach((p) => p <= pages && keep.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => p >= 1 && keep.add(p));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/** "Showing 26–50 of 230" · page size · ‹ 1 … 4 5 6 … 10 ›. Phones show "Page 2 of 10" instead of numbers. */
export function Pagination({ page, pageSize, total, onPage, onPageSize, noun = "rows" }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize?: (n: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "grid h-9 min-w-9 place-items-center rounded-[10px] px-2 text-sm tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm" aria-label="Pages">
      <div className="flex items-center gap-3 text-ink-soft">
        <span>
          Showing <b className="font-semibold text-ink tabular-nums">{from}–{to}</b> of <b className="font-semibold text-ink tabular-nums">{total}</b> {noun}
        </span>
        {onPageSize && (
          <span className="hidden sm:inline-flex">
            <PageSizeButtons value={pageSize} onChange={onPageSize} />
          </span>
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(btn, "hover:bg-paper-2")} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="px-2 text-ink-soft sm:hidden">
            Page {page} of {pages}
          </span>
          {pageList(page, pages).map((p, i) =>
            p == null ? (
              <span key={`gap${i}`} className="hidden px-1 text-ink-mute sm:inline">
                …
              </span>
            ) : (
              <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined} className={cn(btn, "hidden sm:grid", p === page ? "bg-ink font-semibold text-white" : "hover:bg-paper-2")}>
                {p}
              </button>
            ),
          )}
          <button type="button" className={cn(btn, "hover:bg-paper-2")} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </nav>
  );
}

function PageSizeButtons({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-[10px] border border-line p-0.5" role="group" aria-label="Rows per page">
      {PAGE_SIZES.map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={n === value} className={cn("h-7 rounded-lg px-2 text-xs tabular-nums", n === value ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft hover:text-ink")}>
          {n}
        </button>
      ))}
      <span className="pr-1.5 pl-1 text-xs text-ink-mute">per page</span>
    </span>
  );
}

/** Paging for a list already in the browser. Back to page 1 when `resetOn` (search, tab…) changes. */
export function usePaged<T>(list: T[], resetOn = "", initialSize = 50) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const [seen, setSeen] = useState(resetOn);
  if (seen !== resetOn) {
    setSeen(resetOn);
    setPage(1);
  }
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const p = Math.min(page, pages);
  return {
    rows: list.slice((p - 1) * pageSize, p * pageSize),
    bar: { page: p, pageSize, total: list.length, onPage: setPage, onPageSize: (n: number) => (setPageSize(n), setPage(1)) },
  };
}
