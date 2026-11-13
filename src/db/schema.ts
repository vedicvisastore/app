import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** All money values are stored in paise (₹1 = 100). */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductKind = "single" | "bundle";
/** public: shown in store. hidden: draft, not shown. internal: packing/delivery components, admin-only. */
export type Visibility = "public" | "hidden" | "internal";

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    kind: text("kind").$type<ProductKind>().notNull().default("single"),
    /** Group label for bundles, e.g. "Bhakti Boxes", "Japa Sets", "Shringar Kits". */
    bundleGroup: text("bundle_group"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    tagline: text("tagline"),
    description: text("description"),
    price: integer("price").notNull(),
    /** Strike-through price (MRP). Null = no MRP shown. */
    mrp: integer("mrp"),
    cost: integer("cost").notNull().default(0),
    /** Null = stock not tracked (unlimited). */
    stock: integer("stock"),
    visibility: text("visibility").$type<Visibility>().notNull().default("public"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    /** Manual lift: lower number shows first. Null = not pinned. */
    pinRank: integer("pin_rank"),
    /** Added to the trending score. */
    boost: integer("boost").notNull().default(0),
    featured: boolean("featured").notNull().default(false),
    /** Shown in the store with a "Launching soon" tag; can't be bought until it launches. */
    comingSoon: boolean("coming_soon").notNull().default(false),
    /** Optional launch moment: after it passes, the product goes on sale by itself. */
    launchAt: timestamp("launch_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.categoryId), index("products_visibility_idx").on(t.visibility)],
);

export const bundleItems = pgTable(
  "bundle_items",
  {
    bundleId: integer("bundle_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.bundleId, t.productId] })],
);

export type Role = "customer" | "admin";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  role: text("role").$type<Role>().notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_email_idx").on(t.email)],
);

export const sessions = pgTable("sessions", {
  /** sha256 of the cookie token */
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  landmark: text("landmark"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * sale      – automatic price drop on products/categories (shown as sale price in the shop)
 * coupon    – code entered at checkout
 * auto_cart – applied automatically at checkout when the cart qualifies
 */
export type DiscountKind = "sale" | "coupon" | "auto_cart";
export type DiscountType = "percent" | "flat" | "free_shipping";

export const discounts = pgTable(
  "discounts",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").$type<DiscountKind>().notNull(),
    name: text("name").notNull(),
    code: text("code"),
    type: text("type").$type<DiscountType>().notNull(),
    /** percent: 1–100. flat: paise. free_shipping: ignored. */
    value: integer("value").notNull().default(0),
    /** Empty arrays = applies to everything. */
    productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
    categoryIds: jsonb("category_ids").$type<number[]>().notNull().default([]),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    maxDiscount: integer("max_discount"),
    usageLimit: integer("usage_limit"),
    perUserLimit: integer("per_user_limit"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("discounts_code_idx").on(t.code)],
);

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type AddressSnapshot = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type DiscountLine = { id: number; label: string; amount: number; code?: string | null };

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("pending_payment"),
    subtotal: integer("subtotal").notNull(),
    discountTotal: integer("discount_total").notNull().default(0),
    shippingFee: integer("shipping_fee").notNull().default(0),
    total: integer("total").notNull(),
    couponCode: text("coupon_code"),
    discountLines: jsonb("discount_lines").$type<DiscountLine[]>().notNull().default([]),
    shippingAddress: jsonb("shipping_address").$type<AddressSnapshot>().notNull(),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    carrier: text("carrier").notNull().default("India Post"),
    trackingNumber: text("tracking_number"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_rzp_idx").on(t.razorpayOrderId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    image: text("image"),
    unitPrice: integer("unit_price").notNull(),
    unitMrp: integer("unit_mrp"),
    qty: integer("qty").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status"),
    message: text("message").notNull(),
    location: text("location"),
    source: text("source").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const discountUsages = pgTable("discount_usages", {
  id: serial("id").primaryKey(),
  discountId: integer("discount_id")
    .notNull()
    .references(() => discounts.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  eventType: text("event_type"),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Discount = typeof discounts.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type User = typeof users.$inferSelect;

/** Stock ledger: every change to a product's stock, with the balance after it. */
export type StockReason = "opening" | "restock" | "order" | "cancel" | "adjustment" | "damaged" | "return";

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").$type<StockReason>().notNull(),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    note: text("note"),
    /** cost per unit in paise, for restocks */
    unitCost: integer("unit_cost"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId, t.createdAt)],
);

export type StockMovement = typeof stockMovements.$inferSelect;

/** Pincode → location, from India Post's directory (data/pincodes.json). Used by order analytics. */
export const pincodeGeo = pgTable("pincode_geo", {
  pincode: text("pincode").primaryKey(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  district: text("district").notNull().default(""),
  state: text("state").notNull().default(""),
});

/** Accent colours a festival page can use. Theme tokens, so every admin theme still applies. */
export const FESTIVAL_ACCENTS = ["gulal", "gold", "royal", "peacock", "mor"] as const;
export type FestivalAccent = (typeof FESTIVAL_ACCENTS)[number];

/**
 * Custom pages ("festivals" table name kept): a festival or any collection, e.g. Holi 2027 or Corporate gifting, at /c/<slug> with hand-picked products.
 * At most MAX_MENU_PAGES of them can be in the store menu.
 * Visible in the store between showFrom and showUntil while active (see src/lib/festival-status.ts).
 */
export const festivals = pgTable("festivals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Short line under the name, e.g. "Colours, gulal and Radha-Krishna bhakti". */
  tagline: text("tagline"),
  description: text("description"),
  /** The festival day itself, shown as "Holi is on 4 March". */
  festivalDate: timestamp("festival_date", { withTimezone: true }),
  showFrom: timestamp("show_from", { withTimezone: true }),
  showUntil: timestamp("show_until", { withTimezone: true }),
  image: text("image"),
  accent: text("accent").$type<FestivalAccent>().notNull().default("gulal"),
  showInMenu: boolean("show_in_menu").notNull().default(true),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const festivalProducts = pgTable(
  "festival_products",
  {
    festivalId: integer("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.festivalId, t.productId] })],
);

export type Festival = typeof festivals.$inferSelect;
