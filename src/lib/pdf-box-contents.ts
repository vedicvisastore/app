/**
 * Admin → Boxes & sets → Compare contents as a PDF (built in the browser, loaded only when downloaded).
 * Rows are single items (grouped like the screen), columns are boxes; a tick = one, a number = that many.
 * Uses the PDF's built-in Helvetica, which has no ₹ sign, so money is written as "Rs".
 */
import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";

type Item = { id: number; label: string; cost: number; visibility: "public" | "hidden" | "internal" };
type Box = { id: number; label: string; price: number; componentCost: number; visibility: string; components: { productId: number; qty: number }[] };

const INK: [number, number, number] = [17, 24, 39];
const SOFT: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [229, 231, 235];
const BAND: [number, number, number] = [243, 244, 246];
const GREEN: [number, number, number] = [21, 128, 61];
const GREEN_BG: [number, number, number] = [220, 252, 231];
const rs = (paise: number) => `${Math.round(paise / 100).toLocaleString("en-IN")}`;
const GROUPS = [
  ["public", "Store items"],
  ["hidden", "Hidden items"],
  ["internal", "Packing & delivery"],
] as const;

export function buildBoxContentsPdf(items: Item[], boxes: Box[]): Blob {
  const format = boxes.length > 26 ? "a3" : "a4";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format, compress: true });
  const W = doc.internal.pageSize.getWidth();
  const M = 10;
  const productW = 58;
  const costW = 16;
  const usedW = 15;
  const boxW = Math.max(6.5, Math.min(20, (W - 2 * M - productW - costW - usedW) / Math.max(1, boxes.length)));

  // Box names stand upright in the header; the header is as tall as the longest name (capped).
  doc.setFont("helvetica", "bold").setFontSize(7.5);
  const maxName = 52;
  const fit = (s: string) => {
    let t = s;
    while (doc.getTextWidth(t) > maxName && t.length > 3) t = t.slice(0, -2);
    return t === s ? s : `${t.trimEnd()}...`;
  };
  const names = boxes.map((b) => fit(b.label + (b.visibility === "hidden" ? " (hidden)" : "")));
  const headH = Math.min(maxName, Math.max(...names.map((n) => doc.getTextWidth(n)), 10)) + 5;

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...INK);
  doc.text("Box contents", M, M + 6);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...SOFT);
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  doc.text(`VedicVisa · ${date} · ${boxes.length} boxes and sets, ${items.length} items · tick = one in the box, a number = that many · money in Rs`, M, M + 12);

  type Cell = { content: string; qty?: number; colSpan?: number; styles?: Record<string, unknown> };
  const body: Cell[][] = [];
  for (const [vis, title] of GROUPS) {
    const rows = items.filter((p) => p.visibility === vis);
    if (!rows.length) continue;
    body.push([{ content: title, colSpan: boxes.length + 3, styles: { fillColor: BAND, fontStyle: "bold", textColor: SOFT, fontSize: 7.5 } }]);
    for (const p of rows) {
      const used = boxes.filter((b) => b.components.some((c) => c.productId === p.id)).length;
      body.push([
        { content: p.label },
        { content: rs(p.cost) },
        ...boxes.map((b) => ({ content: "", qty: b.components.find((c) => c.productId === p.id)?.qty ?? 0 })),
        { content: used ? String(used) : "none", styles: used ? {} : { textColor: SOFT } },
      ]);
    }
  }
  const total = (label: string, v: (b: Box) => string): Cell[] => [
    { content: label, styles: { fontStyle: "bold" } },
    { content: "" },
    ...boxes.map((b) => ({ content: v(b), styles: { fontStyle: "bold", halign: "center", fontSize: 7 } })),
    { content: "" },
  ];
  const foot = [
    total("Box cost (Rs)", (b) => rs(b.componentCost)),
    total("Box price (Rs)", (b) => rs(b.price)),
    total("Margin", (b) => (b.price ? `${Math.round(((b.price - b.componentCost) / b.price) * 100)}%` : "")),
  ];

  autoTable(doc, {
    startY: M + 17,
    margin: { left: M, right: M, top: M, bottom: 14 },
    head: [[{ content: "Product" }, { content: "Cost (Rs)" }, ...boxes.map(() => ({ content: "" })), { content: "Used in" }]],
    body,
    foot,
    showFoot: "lastPage",
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, textColor: INK, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, lineColor: LINE, lineWidth: { bottom: 0.15 }, valign: "middle", overflow: "ellipsize" },
    headStyles: { fontStyle: "bold", textColor: SOFT, fontSize: 7.5, minCellHeight: headH, valign: "bottom", lineWidth: { bottom: 0.3 } },
    footStyles: { fillColor: BAND, textColor: INK, lineWidth: { bottom: 0.15 } },
    columnStyles: {
      0: { cellWidth: productW },
      1: { cellWidth: costW, halign: "right" },
      ...Object.fromEntries(boxes.map((_, i) => [i + 2, { cellWidth: boxW, halign: "center", cellPadding: 0.5 }])),
      [boxes.length + 2]: { cellWidth: usedW, halign: "center" },
    },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index === 1) d.cell.styles.halign = "right";
      if (d.section === "head" && d.column.index === boxes.length + 2) d.cell.styles.halign = "center";
    },
    didDrawCell: (d: CellHookData) => {
      const i = d.column.index - 2;
      if (i < 0 || i >= boxes.length) return;
      const { x, y, width: w, height: h } = d.cell;
      if (d.section === "head") {
        doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...INK);
        doc.text(names[i], x + w / 2 + 1.2, y + h - 2, { angle: 90 });
        return;
      }
      if (d.section !== "body") return;
      const qty = (d.cell.raw as Cell | undefined)?.qty ?? 0;
      const cx = x + w / 2;
      const cy = y + h / 2;
      if (!qty) {
        doc.setFillColor(209, 213, 219).circle(cx, cy, 0.35, "F");
        return;
      }
      doc.setFillColor(...GREEN_BG).roundedRect(cx - 2.4, cy - 2.4, 4.8, 4.8, 0.9, 0.9, "F");
      if (qty > 1) {
        doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GREEN);
        doc.text(String(qty), cx, cy + 0.1, { align: "center", baseline: "middle" });
      } else {
        doc.setDrawColor(...GREEN).setLineWidth(0.45).setLineCap("round").setLineJoin("round");
        doc.lines([[0.9, 0.9], [1.9, -2]], cx - 1.35, cy + 0.15, [1, 1], "S", false);
      }
    },
  });

  // Page numbers.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...SOFT);
    doc.text(`Page ${p} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }
  return doc.output("blob");
}
