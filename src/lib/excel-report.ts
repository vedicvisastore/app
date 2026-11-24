/**
 * Stock & sales workbook (Admin → Excel → Download → Stock and sales), built in the browser from admin.reportData.
 *
 * Every figure is worked out here AND written as an Excel formula where it is a sum or a difference, so the file
 * checks itself: totals are SUM()s, profit is sales − discounts − cost, closing stock is opening + in − out.
 *
 * Definitions (also written on the Read me sheet):
 *  - An order counts as a sale when it has been paid and is not cancelled or refunded; it falls in the month it was
 *    paid (India time).
 *  - Item sales = what the items sold for (line totals). Discounts = coupon and cart offers. Shipping = delivery fee
 *    charged. Revenue = Item sales − Discounts + Shipping = what customers paid.
 *  - Cost of goods = units sold × the product's cost price today (boxes use their box cost).
 *  - Gross profit = Item sales − Discounts − Cost of goods (shipping is left out: it pays India Post).
 *  - Stock columns come from the stock ledger: Received (opening counts, restocks), Sent out (orders, boxes counted
 *    as their items), Came back (cancellations, returns), Corrections (manual counts), Damaged.
 */
import ExcelJS from "exceljs";

type Data = {
  from: string;
  to: string;
  products: { id: number; sku: string; name: string; kind: "single" | "bundle"; cost: number; price: number; visibility: string; stock: number | null; views: number; category: string | null; group: string | null }[];
  contents: { bundleId: number; productId: number; qty: number }[];
  opening: Record<string, number>;
  movements: { id: number; productId: number; delta: number; balanceAfter: number; reason: string; note: string | null; createdAt: string | Date; orderNumber: string | null }[];
  orders: { id: number; number: string; status: string; counted: boolean; paidAt: string | Date; email: string; name: string; city: string; state: string; subtotal: number; discount: number; shipping: number; total: number; coupon: string | null; offers: { label: string; amount: number; code: string | null }[]; userId: number | null }[];
  lines: { orderId: number; productId: number | null; sku: string; name: string; qty: number; unitPrice: number; lineTotal: number }[];
};

const IST = 5.5 * 3600_000;
const SHYAM = "FF141C4C";
const PAPER = "FFF2F7FB";
const MONEY = "#,##0.00";
const istDate = (d: string | Date) => new Date(new Date(d).getTime() + IST);
const monthKey = (d: string | Date) => istDate(d).toISOString().slice(0, 7);
const yearKey = (d: string | Date) => istDate(d).toISOString().slice(0, 4);
const r = (paise: number) => Math.round(paise) / 100;
const inrText = (rupees: number) => `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const REASON: Record<string, string> = { opening: "Opening count", restock: "Received", order: "Sent out (order)", cancel: "Came back (cancelled)", return: "Came back (returned)", adjustment: "Correction", damaged: "Damaged" };

/** Months (India time) from `from` up to (not including) `to`. */
function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let k = monthKey(from);
  const end = monthKey(new Date(new Date(to).getTime() - 1));
  while (k <= end) {
    out.push(k);
    const [y, m] = k.split("-").map(Number);
    k = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return out;
}

function styleHeader(ws: ExcelJS.Worksheet, row = 1) {
  const h = ws.getRow(row);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SHYAM } };
  h.alignment = { vertical: "middle", wrapText: true };
  h.height = 32;
}

function totalsRow(ws: ExcelJS.Worksheet, firstRow: number, lastRow: number, sumCols: number[], label = "Total") {
  const row = ws.addRow([label]);
  row.font = { bold: true };
  row.border = { top: { style: "thin" } };
  for (const c of sumCols) {
    const L = ws.getColumn(c).letter;
    let result = 0;
    for (let i = firstRow; i <= lastRow; i++) {
      const v = ws.getCell(`${L}${i}`).value;
      result += typeof v === "number" ? v : v && typeof v === "object" && "result" in v ? Number(v.result) || 0 : 0;
    }
    row.getCell(c).value = lastRow >= firstRow ? { formula: `SUM(${L}${firstRow}:${L}${lastRow})`, result: Math.round(result * 100) / 100 } : 0;
  }
  return row;
}

type Sales = { orders: number; units: number; items: number; discount: number; shipping: number; cost: number; cancelled: number };
const emptySales = (): Sales => ({ orders: 0, units: 0, items: 0, discount: 0, shipping: 0, cost: 0, cancelled: 0 });

export async function buildReportWorkbook(d: Data, label: string): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VedicVisa admin";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true; // Excel works every formula out again when the file opens
  const prod = new Map(d.products.map((p) => [p.id, p]));
  const costOf = (productId: number | null, sku: string) => (productId != null ? prod.get(productId)?.cost : d.products.find((p) => p.sku === sku)?.cost) ?? 0;
  const months = monthsBetween(d.from, d.to);
  const counted = d.orders.filter((o) => o.counted);
  const orderById = new Map(d.orders.map((o) => [o.id, o]));

  // ── Sales per month and per year ──
  const byMonth = new Map(months.map((m) => [m, emptySales()]));
  const byYear = new Map<string, Sales>();
  const add = (map: Map<string, Sales>, key: string, fn: (s: Sales) => void) => {
    if (!map.has(key)) map.set(key, emptySales());
    fn(map.get(key)!);
  };
  for (const o of d.orders) {
    const k = monthKey(o.paidAt);
    const y = yearKey(o.paidAt);
    if (!o.counted) {
      add(byMonth, k, (s) => (s.cancelled += 1));
      add(byYear, y, (s) => (s.cancelled += 1));
      continue;
    }
    for (const map of [byMonth, byYear] as const)
      add(map, map === byMonth ? k : y, (s) => {
        s.orders += 1;
        s.items += o.subtotal;
        s.discount += o.discount;
        s.shipping += o.shipping;
      });
  }
  for (const l of d.lines) {
    const o = orderById.get(l.orderId);
    if (!o?.counted) continue;
    const c = costOf(l.productId, l.sku) * l.qty;
    add(byMonth, monthKey(o.paidAt), (s) => ((s.units += l.qty), (s.cost += c)));
    add(byYear, yearKey(o.paidAt), (s) => ((s.units += l.qty), (s.cost += c)));
  }

  // ── Read me ──
  const me = wb.addWorksheet("Read me");
  me.columns = [{ width: 26 }, { width: 90 }];
  me.addRow([`VedicVisa stock and sales: ${label}`]).font = { bold: true, size: 16, color: { argb: SHYAM } };
  me.addRow([`Made ${new Date(Date.now() + IST).toISOString().slice(0, 16).replace("T", " ")} India time. Covers ${istDate(d.from).toISOString().slice(0, 10)} to ${istDate(new Date(new Date(d.to).getTime() - 1)).toISOString().slice(0, 10)}.`]);
  me.addRow([]);
  const defs: [string, string][] = [
    ["Sale", "A paid order that wasn't cancelled or refunded. It belongs to the month it was paid (India time)."],
    ["Item sales", "What the items sold for, before coupons and offers."],
    ["Discounts", "Coupons and automatic cart offers."],
    ["Shipping", "Delivery fee customers paid."],
    ["Revenue", "Item sales − Discounts + Shipping: what customers actually paid."],
    ["Cost of goods", "Units sold × today's cost price of each product (boxes use their box cost)."],
    ["Gross profit", "Item sales − Discounts − Cost of goods. Shipping is left out because it pays India Post."],
    ["Margin", "Gross profit ÷ (Item sales − Discounts)."],
    ["Received", "Stock added: opening counts and restocks."],
    ["Sent out", "Stock that left with orders. A box sold sends out each item inside it."],
    ["Came back", "Stock returned by cancellations and returns."],
    ["Corrections", "Manual count changes (from the admin or the catalogue file), plus or minus."],
    ["Damaged", "Stock written off as damaged."],
    ["Closing stock", "Opening + Received − Sent out + Came back + Corrections − Damaged. Matches the stock ledger exactly."],
    ["Floor fix", "Only when the ledger tried to go below zero (two people buying the last unit at once): the units the store refused to count below 0."],
    ["Units sent inside boxes", "Product analytics: how many of an item left inside boxes that were sold (box sales × the item's quantity in the box)."],
    ["Share", "A row's part of the sheet's total (for example a state's share of revenue)."],
    ["Product profit", "In Product and Category analytics, profit is before order discounts, because coupons and offers apply to whole orders. The Summary's gross profit is after discounts."],
    ["Customers", "Different email addresses with at least one sale in the period. Ordered again = more than one sale in the period."],
  ];
  for (const [k, v] of defs) {
    const row = me.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true };
  }
  me.addRow([]);
  me.addRow(["Sheets", "Summary · Monthly sales · Yearly sales · Product analytics · Category analytics · State analytics · City analytics · Customers · Coupons and offers · Daily sales · Weekdays · Hours · Product stock · Product by month · Stock ledger · Orders · Order lines"]).getCell(1).font = { bold: true };
  me.getRow(me.rowCount).getCell(2).alignment = { wrapText: true };

  const summary = wb.addWorksheet("Summary");

  // ── Monthly / yearly sales ──
  const salesSheet = (name: string, keys: string[], data: Map<string, Sales>, labelOf: (k: string) => string) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: name.startsWith("Monthly") ? "Month" : "Year", width: 12 },
      { header: "Orders", width: 9 },
      { header: "Units sold", width: 10 },
      { header: "Item sales ₹", width: 13 },
      { header: "Discounts ₹", width: 12 },
      { header: "Shipping ₹", width: 11 },
      { header: "Revenue ₹", width: 13 },
      { header: "Cost of goods ₹", width: 14 },
      { header: "Gross profit ₹", width: 14 },
      { header: "Margin", width: 9 },
      { header: "Cancelled or refunded orders", width: 14 },
    ];
    styleHeader(ws);
    keys.forEach((k, i) => {
      const s = data.get(k) ?? emptySales();
      const n = i + 2;
      const net = s.items - s.discount;
      ws.addRow([
        labelOf(k),
        s.orders,
        s.units,
        r(s.items),
        r(s.discount),
        r(s.shipping),
        { formula: `D${n}-E${n}+F${n}`, result: r(net + s.shipping) },
        r(s.cost),
        { formula: `D${n}-E${n}-H${n}`, result: r(net - s.cost) },
        { formula: `IF(D${n}-E${n}=0,0,I${n}/(D${n}-E${n}))`, result: net ? (net - s.cost) / net : 0 },
        s.cancelled,
      ]);
    });
    const last = keys.length + 1;
    const t = totalsRow(ws, 2, last, [2, 3, 4, 5, 6, 7, 8, 9, 11]);
    t.getCell(10).value = { formula: `IF(D${t.number}-E${t.number}=0,0,I${t.number}/(D${t.number}-E${t.number}))`, result: 0 };
    for (const c of [4, 5, 6, 7, 8, 9]) ws.getColumn(c).numFmt = MONEY;
    ws.getColumn(10).numFmt = "0.0%";
  };
  salesSheet("Monthly sales", months, byMonth, monthLabel);
  salesSheet("Yearly sales", [...byYear.keys()].sort(), byYear, (k) => k);

  // ── Analytics: products, categories, places, customers, offers, days ──
  const countedLines = d.lines.filter((l) => orderById.get(l.orderId)?.counted);
  const unitsOf = (orderId: number) => d.lines.filter((l) => l.orderId === orderId).reduce((s, l) => s + l.qty, 0);
  const pct = "0.0%";
  /** Rows with a value column and a "share of total" formula column pointing at the totals row. */
  const shareSheet = (name: string, cols: { header: string; width: number; money?: boolean; pct?: boolean }[], rows: (string | number | ExcelJS.CellFormulaValue)[][], valueCol: number, shareCol: number, sumCols: number[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));
    styleHeader(ws);
    const totalRow = rows.length + 2;
    const V = ws.getColumn(valueCol).letter;
    const num = (v: unknown) => (typeof v === "number" ? v : v && typeof v === "object" && "result" in v ? Number((v as { result: unknown }).result) || 0 : Number(v) || 0);
    const totalValue = rows.reduce((s, r) => s + num(r[valueCol - 1]), 0);
    rows.forEach((r, i) => {
      const n = i + 2;
      r[shareCol - 1] = { formula: `IF(${V}$${totalRow}=0,0,${V}${n}/${V}$${totalRow})`, result: totalValue ? num(r[valueCol - 1]) / totalValue : 0 };
      ws.addRow(r);
    });
    const t = totalsRow(ws, 2, rows.length + 1, sumCols);
    t.getCell(shareCol).value = { formula: `IF(${V}$${totalRow}=0,0,1)`, result: totalValue ? 1 : 0 };
    cols.forEach((c, i) => {
      if (c.money) ws.getColumn(i + 1).numFmt = MONEY;
      if (c.pct) ws.getColumn(i + 1).numFmt = pct;
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  };

  // Products: own sales, units sent inside boxes, profit, share, views.
  type PStat = { orders: Set<number>; units: number; inBoxes: number; sales: number };
  const pstat = new Map<number, PStat>();
  const ps = (id: number) => pstat.get(id) ?? pstat.set(id, { orders: new Set(), units: 0, inBoxes: 0, sales: 0 }).get(id)!;
  for (const l of countedLines) {
    if (l.productId == null) continue;
    const s = ps(l.productId);
    s.orders.add(l.orderId);
    s.units += l.qty;
    s.sales += l.lineTotal;
    for (const c of d.contents.filter((x) => x.bundleId === l.productId)) ps(c.productId).inBoxes += c.qty * l.qty;
  }
  const typeOf = (p: Data["products"][number]) => (p.kind === "bundle" ? "Box" : p.visibility === "internal" ? "Packing" : "Item");
  const prodRows = d.products
    .filter((p) => pstat.has(p.id))
    .map((p) => ({ p, s: pstat.get(p.id)! }))
    .sort((a, b) => b.s.sales - a.s.sales || b.s.units - a.s.units)
    .map(({ p, s }, i) => {
      const n = i + 2;
      const cost = p.cost * s.units;
      return [
        i + 1, p.sku, p.name, typeOf(p), p.kind === "bundle" ? (p.group ?? "") : (p.category ?? ""), s.orders.size, s.units, s.inBoxes,
        { formula: `G${n}+H${n}`, result: s.units + s.inBoxes },
        r(s.sales), 0,
        { formula: `IF(G${n}=0,0,J${n}/G${n})`, result: s.units ? r(s.sales) / s.units : 0 },
        r(cost),
        { formula: `J${n}-M${n}`, result: r(s.sales - cost) },
        { formula: `IF(J${n}=0,0,N${n}/J${n})`, result: s.sales ? (s.sales - cost) / s.sales : 0 },
        p.views, p.stock ?? "not tracked",
      ] as (string | number | ExcelJS.CellFormulaValue)[];
    });
  const pa = shareSheet(
    "Product analytics",
    [
      { header: "Rank", width: 6 }, { header: "SKU", width: 22 }, { header: "Product", width: 30 }, { header: "Type", width: 9 }, { header: "Category or box group", width: 18 },
      { header: "Orders", width: 8 }, { header: "Units sold on their own", width: 11 }, { header: "Units sent inside boxes", width: 11 }, { header: "Total units out", width: 10 },
      { header: "Item sales ₹", width: 13, money: true }, { header: "Share of item sales", width: 10, pct: true }, { header: "Average price ₹", width: 11, money: true },
      { header: "Cost of goods ₹", width: 13, money: true }, { header: "Gross profit ₹", width: 13, money: true }, { header: "Margin", width: 9, pct: true },
      { header: "Page views (all time)", width: 11 }, { header: "Stock now", width: 10 },
    ],
    prodRows, 10, 11, [6, 7, 8, 9, 10, 13, 14],
  );
  pa.getColumn(1).alignment = { horizontal: "center" };

  // Categories (boxes by their group).
  const cat = new Map<string, { products: Set<number>; orders: Set<number>; units: number; sales: number; cost: number }>();
  for (const l of countedLines) {
    const p = l.productId != null ? prod.get(l.productId) : undefined;
    const key = p ? (p.kind === "bundle" ? `Boxes: ${p.group ?? "other"}` : (p.category ?? "No category")) : "Removed products";
    const c = cat.get(key) ?? cat.set(key, { products: new Set(), orders: new Set(), units: 0, sales: 0, cost: 0 }).get(key)!;
    if (l.productId != null) c.products.add(l.productId);
    c.orders.add(l.orderId);
    c.units += l.qty;
    c.sales += l.lineTotal;
    c.cost += costOf(l.productId, l.sku) * l.qty;
  }
  shareSheet(
    "Category analytics",
    [{ header: "Category", width: 26 }, { header: "Different products sold", width: 11 }, { header: "Orders", width: 8 }, { header: "Units", width: 8 }, { header: "Item sales ₹", width: 13, money: true }, { header: "Share of item sales", width: 10, pct: true }, { header: "Cost of goods ₹", width: 13, money: true }, { header: "Gross profit ₹", width: 13, money: true }, { header: "Margin", width: 9, pct: true }],
    [...cat.entries()]
      .sort((a, b) => b[1].sales - a[1].sales)
      .map(([k, c], i) => {
        const n = i + 2;
        return [k, c.products.size, c.orders.size, c.units, r(c.sales), 0, r(c.cost), { formula: `E${n}-G${n}`, result: r(c.sales - c.cost) }, { formula: `IF(E${n}=0,0,H${n}/E${n})`, result: c.sales ? (c.sales - c.cost) / c.sales : 0 }];
      }),
    5, 6, [3, 4, 5, 7, 8],
  );

  // Places: states and cities.
  const place = (keyOf: (o: Data["orders"][number]) => string) => {
    const m = new Map<string, { orders: number; customers: Set<string>; units: number; items: number; discount: number; shipping: number; revenue: number; sample: Data["orders"][number] }>();
    for (const o of counted) {
      const k = keyOf(o);
      const v = m.get(k) ?? m.set(k, { orders: 0, customers: new Set(), units: 0, items: 0, discount: 0, shipping: 0, revenue: 0, sample: o }).get(k)!;
      v.orders++;
      v.customers.add(o.email.toLowerCase());
      v.units += unitsOf(o.id);
      v.items += o.subtotal;
      v.discount += o.discount;
      v.shipping += o.shipping;
      v.revenue += o.total;
    }
    return [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  };
  shareSheet(
    "State analytics",
    [{ header: "State", width: 20 }, { header: "Orders", width: 8 }, { header: "Customers", width: 10 }, { header: "Units", width: 8 }, { header: "Item sales ₹", width: 13, money: true }, { header: "Discounts ₹", width: 12, money: true }, { header: "Shipping ₹", width: 11, money: true }, { header: "Revenue ₹", width: 13, money: true }, { header: "Share of revenue", width: 10, pct: true }, { header: "Average order ₹", width: 12, money: true }],
    place((o) => o.state || "Unknown").map(([k, v], i) => {
      const n = i + 2;
      return [k, v.orders, v.customers.size, v.units, r(v.items), r(v.discount), r(v.shipping), { formula: `E${n}-F${n}+G${n}`, result: r(v.revenue) }, 0, { formula: `IF(B${n}=0,0,H${n}/B${n})`, result: v.orders ? r(v.revenue) / v.orders : 0 }];
    }),
    8, 9, [2, 3, 4, 5, 6, 7, 8],
  );
  shareSheet(
    "City analytics",
    [{ header: "City", width: 20 }, { header: "State", width: 18 }, { header: "Orders", width: 8 }, { header: "Customers", width: 10 }, { header: "Units", width: 8 }, { header: "Revenue ₹", width: 13, money: true }, { header: "Share of revenue", width: 10, pct: true }, { header: "Average order ₹", width: 12, money: true }],
    place((o) => `${(o.city || "Unknown").trim()}|${o.state || ""}`).map(([k, v], i) => {
      const n = i + 2;
      const [city, state] = k.split("|");
      return [city, state, v.orders, v.customers.size, v.units, r(v.revenue), 0, { formula: `IF(C${n}=0,0,F${n}/C${n})`, result: v.orders ? r(v.revenue) / v.orders : 0 }];
    }),
    6, 7, [3, 4, 5, 6],
  );

  // Customers.
  const cust = new Map<string, { name: string; city: string; state: string; orders: number; units: number; revenue: number; first: Date; last: Date; account: boolean }>();
  for (const o of counted) {
    const k = o.email.toLowerCase();
    const at = new Date(o.paidAt);
    const c = cust.get(k) ?? cust.set(k, { name: o.name, city: o.city, state: o.state, orders: 0, units: 0, revenue: 0, first: at, last: at, account: false }).get(k)!;
    c.orders++;
    c.units += unitsOf(o.id);
    c.revenue += o.total;
    if (at < c.first) c.first = at;
    if (at > c.last) ((c.last = at), (c.name = o.name), (c.city = o.city), (c.state = o.state));
    c.account ||= o.userId != null;
  }
  const custRows = [...cust.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  shareSheet(
    "Customers",
    [{ header: "Email", width: 28 }, { header: "Name", width: 20 }, { header: "City", width: 14 }, { header: "State", width: 14 }, { header: "Orders", width: 8 }, { header: "Units", width: 8 }, { header: "Revenue ₹", width: 13, money: true }, { header: "Share of revenue", width: 10, pct: true }, { header: "Average order ₹", width: 12, money: true }, { header: "First order", width: 12 }, { header: "Last order", width: 12 }, { header: "Ordered again", width: 9 }, { header: "Has an account", width: 9 }],
    custRows.map(([email, c], i) => {
      const n = i + 2;
      return [email, c.name, c.city, c.state, c.orders, c.units, r(c.revenue), 0, { formula: `IF(E${n}=0,0,G${n}/E${n})`, result: c.orders ? r(c.revenue) / c.orders : 0 }, istDate(c.first).toISOString().slice(0, 10), istDate(c.last).toISOString().slice(0, 10), c.orders > 1 ? "Yes" : "No", c.account ? "Yes" : "Guest"];
    }),
    7, 8, [5, 6, 7],
  );

  // Coupons and offers.
  const offer = new Map<string, { code: string; uses: number; discount: number; revenue: number }>();
  for (const o of counted)
    for (const x of o.offers) {
      const k = `${x.label}|${x.code ?? ""}`;
      const v = offer.get(k) ?? offer.set(k, { code: x.code ?? "", uses: 0, discount: 0, revenue: 0 }).get(k)!;
      v.uses++;
      v.discount += x.amount;
      v.revenue += o.total;
    }
  shareSheet(
    "Coupons and offers",
    [{ header: "Offer", width: 30 }, { header: "Coupon code", width: 16 }, { header: "Times used", width: 9 }, { header: "Discount given ₹", width: 14, money: true }, { header: "Share of discounts", width: 10, pct: true }, { header: "Revenue of those orders ₹", width: 15, money: true }, { header: "Average discount ₹", width: 12, money: true }],
    [...offer.entries()]
      .sort((a, b) => b[1].discount - a[1].discount)
      .map(([k, v], i) => {
        const n = i + 2;
        return [k.split("|")[0], v.code, v.uses, r(v.discount), 0, r(v.revenue), { formula: `IF(C${n}=0,0,D${n}/C${n})`, result: v.uses ? r(v.discount) / v.uses : 0 }];
      }),
    4, 5, [3, 4, 6],
  );

  // Days, weekdays and hours.
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daily = new Map<string, { orders: number; units: number; revenue: number }>();
  const wk = DAYS.map(() => ({ orders: 0, revenue: 0 }));
  const hr = Array.from({ length: 24 }, () => ({ orders: 0, revenue: 0 }));
  for (const o of counted) {
    const t = istDate(o.paidAt);
    const day = t.toISOString().slice(0, 10);
    const v = daily.get(day) ?? daily.set(day, { orders: 0, units: 0, revenue: 0 }).get(day)!;
    v.orders++;
    v.units += unitsOf(o.id);
    v.revenue += o.total;
    wk[t.getUTCDay()].orders++;
    wk[t.getUTCDay()].revenue += o.total;
    hr[t.getUTCHours()].orders++;
    hr[t.getUTCHours()].revenue += o.total;
  }
  shareSheet(
    "Daily sales",
    [{ header: "Date", width: 12 }, { header: "Weekday", width: 11 }, { header: "Orders", width: 8 }, { header: "Units", width: 8 }, { header: "Revenue ₹", width: 13, money: true }, { header: "Share of revenue", width: 10, pct: true }],
    [...daily.entries()].sort().map(([day, v]) => [day, DAYS[new Date(`${day}T00:00:00Z`).getUTCDay()], v.orders, v.units, r(v.revenue), 0]),
    5, 6, [3, 4, 5],
  );
  const whenCols = (h: string) => [{ header: h, width: 16 }, { header: "Orders", width: 8 }, { header: "Revenue ₹", width: 13, money: true }, { header: "Share of revenue", width: 10, pct: true }];
  shareSheet("Weekdays", whenCols("Weekday (India time)"), DAYS.map((dname, i) => [dname, wk[i].orders, r(wk[i].revenue), 0]), 3, 4, [2, 3]);
  shareSheet("Hours", whenCols("Hour (India time)"), hr.map((h, i) => [`${String(i).padStart(2, "0")}:00 to ${String(i).padStart(2, "0")}:59`, h.orders, r(h.revenue), 0]), 3, 4, [2, 3]);

  // ── Summary (first sheet after Read me) ──
  {
    const T = months.length + 2; // totals row on Monthly sales
    const M = (col: string) => `'Monthly sales'!${col}${T}`;
    const tot = [...byMonth.values()].reduce((a, s) => ({ orders: a.orders + s.orders, units: a.units + s.units, items: a.items + s.items, discount: a.discount + s.discount, shipping: a.shipping + s.shipping, cost: a.cost + s.cost, cancelled: a.cancelled + s.cancelled }), emptySales());
    const revenue = tot.items - tot.discount + tot.shipping;
    const profit = tot.items - tot.discount - tot.cost;
    const repeat = [...cust.values()].filter((c) => c.orders > 1).length;
    const topProduct = prodRows[0] ? `${prodRows[0][2]} (${inrText(Number(prodRows[0][9]))})` : "None";
    const topState = place((o) => o.state || "Unknown")[0];
    const bestMonth = [...byMonth.entries()].sort((a, b) => b[1].items - b[1].discount - (a[1].items - a[1].discount))[0];
    summary.columns = [{ width: 30 }, { width: 26 }, { width: 60 }];
    summary.addRow([`Summary: ${label}`]).font = { bold: true, size: 16, color: { argb: SHYAM } };
    summary.addRow([]);
    const rowsS: [string, number | string | ExcelJS.CellFormulaValue, string, string?][] = [
      ["Orders (sales)", { formula: M("B"), result: tot.orders }, "Paid orders, not cancelled or refunded"],
      ["Revenue ₹", { formula: M("G"), result: r(revenue) }, "What customers paid", MONEY],
      ["Item sales ₹", { formula: M("D"), result: r(tot.items) }, "Before discounts", MONEY],
      ["Discounts ₹", { formula: M("E"), result: r(tot.discount) }, "Coupons and offers", MONEY],
      ["Shipping collected ₹", { formula: M("F"), result: r(tot.shipping) }, "", MONEY],
      ["Cost of goods ₹", { formula: M("H"), result: r(tot.cost) }, "At today's cost prices", MONEY],
      ["Gross profit ₹", { formula: M("I"), result: r(profit) }, "Item sales − Discounts − Cost of goods", MONEY],
      ["Margin", { formula: `IF(${M("D")}-${M("E")}=0,0,${M("I")}/(${M("D")}-${M("E")}))`, result: tot.items - tot.discount ? profit / (tot.items - tot.discount) : 0 }, "Gross profit ÷ sales after discounts", "0.0%"],
      ["Average order ₹", { formula: `IF(${M("B")}=0,0,${M("G")}/${M("B")})`, result: tot.orders ? r(revenue) / tot.orders : 0 }, "Revenue ÷ orders", MONEY],
      ["Units sold", { formula: M("C"), result: tot.units }, "Boxes count as one unit each"],
      ["Customers", cust.size, "Different email addresses that bought"],
      ["Customers who ordered again", repeat, `${cust.size ? Math.round((repeat / cust.size) * 100) : 0}% of customers`],
      ["Cancelled or refunded orders", { formula: M("K"), result: tot.cancelled }, "Paid, then cancelled or refunded"],
      ["Best product", topProduct, "By item sales (see Product analytics)"],
      ["Best state", topState ? `${topState[0]} (${inrText(r(topState[1].revenue))})` : "None", "By revenue (see State analytics)"],
      ["Best month", bestMonth && bestMonth[1].orders ? `${monthLabel(bestMonth[0])} (${inrText(r(bestMonth[1].items - bestMonth[1].discount))} after discounts)` : "None", "See Monthly sales"],
    ];
    for (const [k, v, note, fmt] of rowsS) {
      const row = summary.addRow([k, v, note]);
      row.getCell(1).font = { bold: true };
      row.getCell(3).font = { color: { argb: "FF6B7280" } };
      if (fmt) row.getCell(2).numFmt = fmt;
      row.getCell(2).alignment = { horizontal: "left" };
    }
  }

  // ── Stock per product: whole period and per month ──
  const movesBy = new Map<number, Data["movements"]>();
  for (const m of d.movements) (movesBy.get(m.productId) ?? movesBy.set(m.productId, []).get(m.productId)!).push(m);
  const soldBy = new Map<string, { units: number; items: number }>(); // `${productId}|${month}` and `${productId}|all`
  for (const l of d.lines) {
    const o = orderById.get(l.orderId);
    if (!o?.counted || l.productId == null) continue;
    for (const k of [`${l.productId}|${monthKey(o.paidAt)}`, `${l.productId}|all`]) {
      const v = soldBy.get(k) ?? { units: 0, items: 0 };
      v.units += l.qty;
      v.items += l.lineTotal;
      soldBy.set(k, v);
    }
  }
  type Flow = { opening: number; received: number; sent: number; back: number; corr: number; damaged: number; closing: number };
  const flow = (opening: number, moves: Data["movements"]): Flow => {
    const f: Flow = { opening, received: 0, sent: 0, back: 0, corr: 0, damaged: 0, closing: opening };
    for (const m of moves) {
      if (m.reason === "opening" || m.reason === "restock") f.received += m.delta;
      else if (m.reason === "order") f.sent += -m.delta;
      else if (m.reason === "cancel" || m.reason === "return") f.back += m.delta;
      else if (m.reason === "damaged") f.damaged += -m.delta;
      else f.corr += m.delta;
      f.closing = m.balanceAfter;
    }
    return f;
  };
  const stockHeader = [
    { header: "SKU", width: 22 },
    { header: "Product", width: 30 },
    { header: "Type", width: 9 },
    { header: "Opening stock", width: 10 },
    { header: "Received", width: 10 },
    { header: "Sent out", width: 10 },
    { header: "Came back", width: 10 },
    { header: "Corrections", width: 11 },
    { header: "Damaged", width: 10 },
    { header: "Floor fix", width: 9 },
    { header: "Closing stock", width: 10 },
    { header: "Units sold on their own", width: 12 },
    { header: "Item sales ₹", width: 13 },
    { header: "Cost of goods ₹", width: 14 },
    { header: "Gross profit ₹", width: 14 },
  ];
  const stockRow = (ws: ExcelJS.Worksheet, lead: (string | number)[], f: Flow, sold: { units: number; items: number }, cost: number) => {
    const n = ws.rowCount + 1;
    const fix = f.closing - (f.opening + f.received - f.sent + f.back + f.corr - f.damaged);
    const off = lead.length - 3; // extra leading columns (month) shift the letters
    const L = (i: number) => ws.getColumn(i + off).letter;
    ws.addRow([
      ...lead,
      f.opening,
      f.received,
      f.sent,
      f.back,
      f.corr,
      f.damaged,
      fix,
      { formula: `${L(4)}${n}+${L(5)}${n}-${L(6)}${n}+${L(7)}${n}+${L(8)}${n}-${L(9)}${n}+${L(10)}${n}`, result: f.closing },
      sold.units,
      r(sold.items),
      r(cost * sold.units),
      { formula: `${L(13)}${n}-${L(14)}${n}`, result: r(sold.items - cost * sold.units) },
    ]);
  };

  const whole = wb.addWorksheet("Product stock", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  whole.columns = stockHeader;
  styleHeader(whole);
  for (const p of d.products) {
    const opening = d.opening[p.id] ?? 0;
    const moves = movesBy.get(p.id) ?? [];
    const sold = soldBy.get(`${p.id}|all`) ?? { units: 0, items: 0 };
    if (!moves.length && !sold.units && opening === 0 && p.stock == null) continue;
    stockRow(whole, [p.sku, p.name, p.kind === "bundle" ? "Box" : p.visibility === "internal" ? "Packing" : "Item"], flow(opening, moves), sold, p.cost);
  }
  totalsRow(whole, 2, whole.rowCount, [12, 13, 14, 15]);
  for (const c of [13, 14, 15]) whole.getColumn(c).numFmt = MONEY;

  const monthly = wb.addWorksheet("Product by month", { views: [{ state: "frozen", xSplit: 3, ySplit: 1 }] });
  monthly.columns = [{ header: "Month", width: 10 }, ...stockHeader];
  styleHeader(monthly);
  for (const p of d.products) {
    let opening = d.opening[p.id] ?? 0;
    const moves = movesBy.get(p.id) ?? [];
    for (const m of months) {
      const inMonth = moves.filter((x) => monthKey(x.createdAt) === m);
      const sold = soldBy.get(`${p.id}|${m}`) ?? { units: 0, items: 0 };
      const f = flow(opening, inMonth);
      if (inMonth.length || sold.units) stockRow(monthly, [monthLabel(m), p.sku, p.name, p.kind === "bundle" ? "Box" : p.visibility === "internal" ? "Packing" : "Item"], f, sold, p.cost);
      opening = f.closing;
    }
  }
  for (const c of [14, 15, 16]) monthly.getColumn(c).numFmt = MONEY;
  monthly.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 16 } };

  // ── Ledger, orders, order lines ──
  const ledger = wb.addWorksheet("Stock ledger", { views: [{ state: "frozen", ySplit: 1 }] });
  ledger.columns = [{ header: "Date (India)", width: 17 }, { header: "SKU", width: 22 }, { header: "Product", width: 30 }, { header: "What happened", width: 22 }, { header: "Change", width: 9 }, { header: "Stock after", width: 10 }, { header: "Order", width: 12 }, { header: "Note", width: 40 }];
  styleHeader(ledger);
  for (const m of d.movements) {
    const p = prod.get(m.productId);
    ledger.addRow([istDate(m.createdAt).toISOString().slice(0, 16).replace("T", " "), p?.sku ?? "", p?.name ?? "", REASON[m.reason] ?? m.reason, m.delta, m.balanceAfter, m.orderNumber ?? "", m.note ?? ""]);
  }
  ledger.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

  const ords = wb.addWorksheet("Orders", { views: [{ state: "frozen", ySplit: 1 }] });
  ords.columns = [{ header: "Paid (India)", width: 17 }, { header: "Order", width: 12 }, { header: "Status", width: 11 }, { header: "Counted as a sale", width: 10 }, { header: "Customer", width: 22 }, { header: "Email", width: 26 }, { header: "City", width: 14 }, { header: "State", width: 14 }, { header: "Item sales ₹", width: 12 }, { header: "Discounts ₹", width: 11 }, { header: "Shipping ₹", width: 11 }, { header: "Revenue ₹", width: 12 }, { header: "Coupon", width: 14 }];
  styleHeader(ords);
  for (const o of d.orders) {
    const n = ords.rowCount + 1;
    ords.addRow([istDate(o.paidAt).toISOString().slice(0, 16).replace("T", " "), o.number, o.status, o.counted ? "Yes" : "No", o.name, o.email, o.city, o.state, r(o.subtotal), r(o.discount), r(o.shipping), { formula: `I${n}-J${n}+K${n}`, result: r(o.total) }, o.coupon ?? ""]);
  }
  for (const c of [9, 10, 11, 12]) ords.getColumn(c).numFmt = MONEY;
  ords.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } };

  const lines = wb.addWorksheet("Order lines", { views: [{ state: "frozen", ySplit: 1 }] });
  lines.columns = [{ header: "Paid (India)", width: 17 }, { header: "Order", width: 12 }, { header: "Counted as a sale", width: 10 }, { header: "SKU", width: 22 }, { header: "Product", width: 30 }, { header: "Qty", width: 6 }, { header: "Unit price ₹", width: 11 }, { header: "Line total ₹", width: 12 }, { header: "Unit cost ₹", width: 11 }, { header: "Line cost ₹", width: 12 }, { header: "Line profit ₹", width: 12 }];
  styleHeader(lines);
  for (const l of d.lines) {
    const o = orderById.get(l.orderId);
    if (!o) continue;
    const n = lines.rowCount + 1;
    const uc = costOf(l.productId, l.sku);
    lines.addRow([istDate(o.paidAt).toISOString().slice(0, 16).replace("T", " "), o.number, o.counted ? "Yes" : "No", l.sku, l.name, l.qty, r(l.unitPrice), r(l.lineTotal), r(uc), { formula: `F${n}*I${n}`, result: r(uc * l.qty) }, { formula: `H${n}-J${n}`, result: r(l.lineTotal - uc * l.qty) }]);
  }
  for (const c of [7, 8, 9, 10, 11]) lines.getColumn(c).numFmt = MONEY;
  lines.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } };

  for (const ws of wb.worksheets) ws.eachRow((row, n) => n > 1 && n % 2 === 0 && ws.name !== "Read me" && row.eachCell((c) => (c.fill ??= { type: "pattern", pattern: "solid", fgColor: { argb: PAPER } })));
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
