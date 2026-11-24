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
  products: { id: number; sku: string; name: string; kind: "single" | "bundle"; cost: number; price: number; visibility: string; stock: number | null }[];
  opening: Record<string, number>;
  movements: { id: number; productId: number; delta: number; balanceAfter: number; reason: string; note: string | null; createdAt: string | Date; orderNumber: string | null }[];
  orders: { id: number; number: string; status: string; counted: boolean; paidAt: string | Date; email: string; name: string; city: string; state: string; subtotal: number; discount: number; shipping: number; total: number; coupon: string | null }[];
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
  ];
  for (const [k, v] of defs) {
    const row = me.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true };
  }
  me.addRow([]);
  me.addRow(["Sheets", "Monthly sales · Yearly sales · Product stock (whole period) · Product by month · Stock ledger · Orders · Order lines"]).getCell(1).font = { bold: true };

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
