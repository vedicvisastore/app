"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { useQuote } from "@/components/cart/cart-drawer";
import { CouponField, Totals } from "@/components/cart/summary";
import { Button, ButtonLink, Container, Media, ProductArt, Spinner } from "@/components/ui";
import type { Address } from "@/db/schema";
import { useTRPC } from "@/lib/trpc/client";
import { cn, INDIAN_STATES, inr } from "@/lib/utils";

type Form = { name: string; phone: string; line1: string; line2: string; landmark: string; city: string; state: string; pincode: string };
const empty: Form = { name: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type RazorpayParams = { key: string; orderId: string; amount: number; currency: string; prefill: { name: string; email: string; contact: string } };
type PendingOrder = { key: string; number: string; razorpay?: RazorpayParams; mock?: { amount: number } };

/**
 * Checkout as an explicit state machine:
 *   idle ──SUBMIT──▶ creating ──AWAIT──▶ paying ──VERIFY──▶ verifying ──VERIFIED──▶ done
 *                       │                 │  └──DISMISSED / PAYMENT_FAILED──▶ unpaid ──(Pay again, same order)──▶ paying
 *                       └──FAILED──▶ idle(error)          verifying ──FAILED──▶ idle(error)
 */
type Phase =
  | { name: "idle"; error?: string }
  | { name: "creating" }
  | { name: "paying"; order: PendingOrder }
  | { name: "unpaid"; order: PendingOrder; error?: string }
  | { name: "verifying"; order: PendingOrder }
  | { name: "done"; number: string };

type Event =
  | { type: "SUBMIT" }
  | { type: "AWAIT"; order: PendingOrder }
  | { type: "DISMISSED" }
  | { type: "PAYMENT_FAILED"; error: string }
  | { type: "VERIFY" }
  | { type: "VERIFIED"; number: string }
  | { type: "FAILED"; error: string };

function checkoutReducer(state: Phase, event: Event): Phase {
  switch (event.type) {
    case "SUBMIT":
      return state.name === "idle" || state.name === "unpaid" ? { name: "creating" } : state;
    case "AWAIT":
      return state.name === "creating" || state.name === "unpaid" ? { name: "paying", order: event.order } : state;
    case "DISMISSED":
      return state.name === "paying" ? { name: "unpaid", order: state.order } : state;
    case "PAYMENT_FAILED":
      return state.name === "paying" || state.name === "unpaid" ? { name: "unpaid", order: state.order, error: event.error } : state;
    case "VERIFY":
      return state.name === "paying" ? { name: "verifying", order: state.order } : state;
    case "VERIFIED":
      return { name: "done", number: event.number };
    case "FAILED":
      return state.name === "done" ? state : { name: "idle", error: event.error };
  }
}

export function CheckoutForm({ email, addresses, mock, adminTest = false }: { email: string; addresses: Address[]; mock: boolean; adminTest?: boolean }) {
  const trpc = useTRPC();
  const router = useRouter();
  const cart = useCart();
  const { data: quote, isFetching } = useQuote();
  const [selected, setSelected] = useState<number | "new">(addresses[0]?.id ?? "new");
  const [form, setForm] = useState<Form>(empty);
  const [save, setSave] = useState(true);
  const [phase, dispatch] = useReducer(checkoutReducer, { name: "idle" });
  const busy = phase.name === "creating" || phase.name === "paying" || phase.name === "verifying" || phase.name === "done";
  const error = "error" in phase ? phase.error : undefined;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Pincode → city/state
  const pinOk = /^[1-9]\d{5}$/.test(form.pincode);
  const pin = useQuery({ ...trpc.pincode.lookup.queryOptions({ pincode: form.pincode }), enabled: selected === "new" && pinOk });
  useEffect(() => {
    const d = pin.data;
    if (d && d.found) {
      const { city, state } = d;
      const match = INDIAN_STATES.find((s) => s.toLowerCase() === state.toLowerCase()) ?? state;
      setForm((f) => ({ ...f, city: f.city || city, state: match }));
    }
  }, [pin.data]);

  const create = useMutation(trpc.checkout.create.mutationOptions());
  const verify = useMutation(trpc.checkout.verify.mutationOptions());

  const finish = (number: string) => {
    dispatch({ type: "VERIFIED", number });
    cart.clear();
    router.replace(`/account/orders/${number}?placed=1`);
  };

  const confirmPayment = async (number: string, payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | { mock: true }) => {
    dispatch({ type: "VERIFY" });
    try {
      await verify.mutateAsync({ number, ...payload });
      finish(number);
    } catch (err) {
      dispatch({ type: "FAILED", error: (err as Error).message });
    }
  };

  const openPayment = async (order: PendingOrder) => {
    if (order.mock) return dispatch({ type: "AWAIT", order });
    if (!(await loadRazorpay()) || !window.Razorpay) return dispatch({ type: "FAILED", error: "Couldn't load the payment window. Check your connection and try again." });
    dispatch({ type: "AWAIT", order });
    const r = order.razorpay!;
    const rzp = new window.Razorpay({
      key: r.key,
      order_id: r.orderId,
      amount: r.amount,
      currency: r.currency,
      name: "VedicVisa",
      description: `Order ${order.number}`,
      image: `${window.location.origin}/brand/logo-round.jpg`,
      prefill: r.prefill,
      theme: { color: "#1f3fbf" },
      handler: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => confirmPayment(order.number, resp),
      modal: { ondismiss: () => dispatch({ type: "DISMISSED" }) },
    });
    rzp.on("payment.failed", () => dispatch({ type: "PAYMENT_FAILED", error: "The payment didn't go through. You haven't been charged; try again or use another method." }));
    rzp.open();
  };

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const addr = selected === "new" ? form : addresses.find((a) => a.id === selected);
    if (!addr) return dispatch({ type: "FAILED", error: "Choose a delivery address." });
    const input = {
      lines: cart.lines,
      couponCode: cart.coupon,
      address: { name: addr.name, phone: addr.phone, line1: addr.line1, line2: addr.line2 || null, landmark: addr.landmark || null, city: addr.city, state: addr.state, pincode: addr.pincode },
      saveAddress: selected === "new" && save,
      addressId: selected === "new" ? undefined : selected,
    };
    const key = JSON.stringify([input.lines, input.couponCode, input.address]);

    // Payment window was closed: reopen the same order instead of creating a duplicate, unless the cart or address changed.
    if (phase.name === "unpaid" && phase.order.key === key) return openPayment(phase.order);

    dispatch({ type: "SUBMIT" });
    try {
      const res = await create.mutateAsync(input);
      if ("paid" in res) return finish(res.number);
      const order: PendingOrder = "mock" in res ? { key, number: res.number, mock: { amount: res.amount ?? 0 } } : { key, number: res.number, razorpay: res.razorpay };
      await openPayment(order);
    } catch (err) {
      dispatch({ type: "FAILED", error: (err as Error).message });
    }
  }

  if (cart.ready && cart.lines.length === 0 && phase.name === "idle")
    return (
      <Container className="flex flex-col items-center py-28 text-center">
        <h1 className="text-[length:var(--text-display-s)]">Nothing to Check Out</h1>
        <p className="mt-3 text-ink-soft">Your cart is empty.</p>
        <ButtonLink href="/shop" className="mt-6">
          Browse the shop
        </ButtonLink>
      </Container>
    );

  return (
    <Container className="pt-10">
      <h1 className="text-[length:var(--text-display-s)]">Checkout</h1>
      <p className="mt-2 text-ink-soft">
        Logged in as <b className="text-ink">{email}</b>
      </p>

      <form onSubmit={pay} className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        <section aria-labelledby="addr">
          <h2 id="addr" className="font-sans text-xl font-bold">
            Delivery address
          </h2>
          {addresses.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => (
                <label key={a.id} className={cn("cursor-pointer rounded-2xl border-[1.5px] p-4 transition-colors", selected === a.id ? "border-royal bg-sky/60" : "border-line hover:border-line-strong")}>
                  <input type="radio" name="address" className="sr-only" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                  <p className="font-bold">{a.name}</p>
                  <p className="text-sm text-ink-soft">
                    {a.line1}
                    {a.line2 && `, ${a.line2}`}, {a.city}, {a.state} {a.pincode}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{a.phone}</p>
                </label>
              ))}
              <label className={cn("flex cursor-pointer items-center justify-center rounded-2xl border-[1.5px] border-dashed p-4 font-bold transition-colors", selected === "new" ? "border-royal bg-sky/60 text-royal" : "border-line-strong text-ink-soft")}>
                <input type="radio" name="address" className="sr-only" checked={selected === "new"} onChange={() => setSelected("new")} />
                Deliver somewhere else
              </label>
            </div>
          )}

          {selected === "new" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" required autoComplete="name" className="field" value={form.name} onChange={set("name")} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Mobile number</label>
                <input id="phone" required type="tel" inputMode="tel" autoComplete="tel" className="field" value={form.phone} onChange={set("phone")} placeholder="10-digit number" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="line1">House / flat, street</label>
                <input id="line1" required autoComplete="address-line1" className="field" value={form.line1} onChange={set("line1")} />
              </div>
              <div>
                <label className="label" htmlFor="line2">Area, colony (optional)</label>
                <input id="line2" autoComplete="address-line2" className="field" value={form.line2} onChange={set("line2")} />
              </div>
              <div>
                <label className="label" htmlFor="landmark">Landmark (optional)</label>
                <input id="landmark" className="field" value={form.landmark} onChange={set("landmark")} />
              </div>
              <div>
                <label className="label" htmlFor="pincode">Pincode</label>
                <input id="pincode" required inputMode="numeric" maxLength={6} autoComplete="postal-code" className="field" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, ""), city: "", state: f.state }))} />
                <p className="mt-1 h-4 text-xs text-ink-mute" aria-live="polite">
                  {pin.isFetching ? "Looking up pincode…" : pin.data?.found ? <span className="flex items-center gap-1 text-mor"><MapPin className="size-3" /> {pin.data.city}, {pin.data.state}</span> : pinOk && pin.data && !pin.data.found && !("offline" in pin.data) ? "Pincode not found, please check it" : ""}
                </p>
              </div>
              <div>
                <label className="label" htmlFor="city">City / district</label>
                <input id="city" required autoComplete="address-level2" className="field" value={form.city} onChange={set("city")} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="state">State</label>
                <select id="state" required autoComplete="address-level1" className="field" value={form.state} onChange={set("state")}>
                  <option value="">Choose state</option>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2">
                <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-4 accent-royal" />
                Save this address for next time
              </label>
            </div>
          )}
        </section>

        <aside className="h-fit space-y-5 rounded-3xl border border-line p-6 lg:sticky lg:top-28">
          <h2 className="font-sans text-xl font-bold">Order Summary</h2>
          <ul className="max-h-64 space-y-3 overflow-y-auto">
            {quote?.lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3">
                <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-sky">
                  {l.image ? <Media src={l.image} alt="" className="h-full w-full object-cover" /> : <ProductArt name={l.name} seed={l.productId} />}
                  <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{l.qty}</span>
                </div>
                <p className="flex-1 text-sm leading-snug">{l.name}</p>
                <p className="text-sm font-bold tabular-nums">{inr(l.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <CouponField quote={quote} />
          <Totals quote={quote} loading={isFetching} />
          {(error || quote?.problems[0]) && <p className="rounded-lg bg-gulal-soft px-3 py-2 text-sm font-normal text-gulal">{error ?? quote?.problems[0]}</p>}
          <Button size="lg" className="w-full" disabled={busy || !quote || !!quote.problems.length || isFetching}>
            {busy ? <Spinner /> : <Lock className="size-4" />} {phase.name === "verifying" ? "Confirming payment…" : phase.name === "unpaid" ? `Retry payment of ${quote ? inr(quote.total) : ""}` : `Pay ${quote ? inr(quote.total) : ""}`}
          </Button>
          <p className="text-center text-xs text-ink-mute">Pay with UPI, cards or netbanking. By paying you agree to our <Link href="/shipping" className="underline">shipping and returns policy</Link>.</p>
        </aside>
      </form>

      {phase.name === "paying" && phase.order.mock && mock && (
        <div className="fixed inset-0 z-[400] grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="mock-title">
          <div className="w-full max-w-sm rounded-3xl bg-paper p-6 text-center shadow-float">
            <p className="text-sm font-bold text-gold-ink">{adminTest ? "Admin Test Order" : "Test Mode"}</p>
            <h2 id="mock-title" className="mt-1 text-3xl">Skip Payment</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {adminTest
                ? `You’re signed in as an admin, so no money is taken. Order ${phase.order.number} (${inr(phase.order.mock.amount)}) will be marked paid, stock goes out and the confirmation email is sent. Cancel it in Admin → Orders with “put back in stock” when you’re done testing.`
                : `Razorpay keys aren’t set, so this dev build skips the real payment window. Order ${phase.order.number}, ${inr(phase.order.mock.amount)}.`}
            </p>
            <div className="mt-6 grid gap-2">
              <Button onClick={() => confirmPayment(phase.order.number, { mock: true })}>Mark as Paid</Button>
              <Button variant="ghost" onClick={() => dispatch({ type: "DISMISSED" })}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
