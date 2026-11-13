/**
 * The order lifecycle as an explicit state machine. Shared by the server (which enforces it)
 * and the admin UI (which only offers moves the machine allows).
 *
 *   pending_payment ──pay──▶ paid ──pack──▶ packed ──ship──▶ shipped ──deliver──▶ delivered
 *        │                    │  └────────ship─────────────▲      │                  │
 *        └──cancel──▶ cancelled ◀──cancel── paid / packed  │      └──refund──▶ refunded ◀──refund── delivered
 *                                         paid / packed ──refund──▶ refunded
 */
import type { OrderStatus } from "@/db/schema";

export type Actor = "customer" | "payment" | "admin" | "courier" | "system";

type Rule = { to: OrderStatus; by: readonly Actor[]; needsTracking?: boolean };

export const ORDER_MACHINE: Record<OrderStatus, readonly Rule[]> = {
  pending_payment: [
    { to: "paid", by: ["payment", "system", "admin"] },
    { to: "cancelled", by: ["admin", "system"] },
  ],
  paid: [
    { to: "packed", by: ["admin"] },
    { to: "shipped", by: ["admin", "courier"], needsTracking: true },
    { to: "cancelled", by: ["admin"] },
    { to: "refunded", by: ["admin"] },
  ],
  packed: [
    { to: "shipped", by: ["admin", "courier"], needsTracking: true },
    { to: "cancelled", by: ["admin"] },
    { to: "refunded", by: ["admin"] },
  ],
  shipped: [
    { to: "delivered", by: ["admin", "courier"] },
    { to: "refunded", by: ["admin"] },
  ],
  delivered: [{ to: "refunded", by: ["admin"] }],
  cancelled: [],
  refunded: [],
};

export const TERMINAL: readonly OrderStatus[] = ["cancelled", "refunded"];

export function nextStates(from: OrderStatus, actor: Actor): OrderStatus[] {
  return ORDER_MACHINE[from].filter((r) => r.by.includes(actor)).map((r) => r.to);
}

export function ruleFor(from: OrderStatus, to: OrderStatus, actor: Actor): Rule | null {
  return ORDER_MACHINE[from].find((r) => r.to === to && r.by.includes(actor)) ?? null;
}

/** Statuses after payment where stock has been taken and money received. */
export const PAID_STATES: readonly OrderStatus[] = ["paid", "packed", "shipped", "delivered"];

export const STATUS_MESSAGE: Record<OrderStatus, string> = {
  pending_payment: "Order placed, waiting for payment",
  paid: "Payment received. We're preparing your order.",
  packed: "Packed with care and ready for India Post",
  shipped: "Handed over to India Post",
  delivered: "Delivered. Hare Krishna!",
  cancelled: "Order cancelled",
  refunded: "Refund issued",
};

/** The one forward move the admin's primary button offers, per state. */
export const PRIMARY_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending_payment: { to: "paid", label: "Mark as paid" },
  paid: { to: "packed", label: "Mark as packed" },
  packed: { to: "shipped", label: "Mark as shipped" },
  shipped: { to: "delivered", label: "Mark as delivered" },
};
