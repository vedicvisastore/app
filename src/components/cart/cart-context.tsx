"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = { productId: number; qty: number };
type CartState = {
  lines: CartLine[];
  coupon: string | null;
  open: boolean;
  ready: boolean;
  count: number;
  add: (productId: number, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  setCoupon: (c: string | null) => void;
  setOpen: (o: boolean) => void;
};

const Ctx = createContext<CartState | null>(null);
const KEY = "vv_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { lines?: CartLine[]; coupon?: string | null };
        setLines((parsed.lines ?? []).filter((l) => Number.isInteger(l.productId) && l.qty > 0));
        setCoupon(parsed.coupon ?? null);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ lines, coupon }));
    } catch {}
  }, [lines, coupon, ready]);

  const add = useCallback((productId: number, qty = 1) => {
    setLines((ls) => {
      const found = ls.find((l) => l.productId === productId);
      if (found) return ls.map((l) => (l.productId === productId ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...ls, { productId, qty }];
    });
    setOpen(true);
  }, []);
  const setQty = useCallback(
    (productId: number, qty: number) =>
      setLines((ls) => (qty <= 0 ? ls.filter((l) => l.productId !== productId) : ls.map((l) => (l.productId === productId ? { ...l, qty: Math.min(20, qty) } : l)))),
    [],
  );
  const remove = useCallback((productId: number) => setLines((ls) => ls.filter((l) => l.productId !== productId)), []);
  const clear = useCallback(() => {
    setLines([]);
    setCoupon(null);
  }, []);

  const value = useMemo(
    () => ({ lines, coupon, open, ready, count: lines.reduce((s, l) => s + l.qty, 0), add, setQty, remove, clear, setCoupon, setOpen }),
    [lines, coupon, open, ready, add, setQty, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
