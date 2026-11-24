"use client";
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
export function MoneyInput({ value, onChange, allowEmpty, ...rest }: { value: number | null; onChange: (paise: number | null) => void; allowEmpty?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
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
        className="field pl-7 tabular-nums"
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

