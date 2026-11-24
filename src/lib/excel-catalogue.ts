/**
 * Catalogue workbook, built and read in the browser (keeps the server light). Columns come from catalogue-sheet.ts.
 * The downloaded file is also the template: edit it and upload it back.
 */
import ExcelJS from "exceljs";
import { COLUMNS, columnByHeader, columnsFor, headerOf, VISIBILITY_CHOICES, VISIBILITY_LABEL, type ColKey, type RawRow, type SheetName } from "./catalogue-sheet";

export type CatalogueData = {
  categories: string[];
  products: {
    sku: string;
    kind: "single" | "bundle";
    name: string;
    adminName: string | null;
    group: string | null;
    category: string | null;
    tagline: string | null;
    description: string | null;
    price: number;
    mrp: number | null;
    cost: number;
    stock: number | null;
    visibility: "public" | "hidden" | "internal";
    pinRank: number | null;
    boost: number;
    featured: boolean;
    comingSoon: boolean;
    launchAt: Date | string | null;
    photos: string[];
    contents: { sku: string; qty: number }[];
  }[];
};

const SHYAM = "FF141C4C";
const GOLD = "FFEFB233";
const PAPER = "FFF2F7FB";
const GREY = "FFE6EAF0";
const IST = 5.5 * 3600_000;
const rupees = (paise: number) => Math.round(paise) / 100;
const istText = (d: Date | string | null) => (d ? new Date(new Date(d).getTime() + IST).toISOString().slice(0, 16).replace("T", " ") : "");

/** The catalogue as a workbook: Read me, Products, Boxes, Categories. Empty `products` gives a blank template. */
export async function buildCatalogueWorkbook(data: CatalogueData): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VedicVisa admin";
  wb.created = new Date();
  readMe(wb.addWorksheet("Read me", { properties: { tabColor: { argb: GOLD } } }));

  for (const sheet of ["Products", "Boxes"] as SheetName[]) {
    const ws = wb.addWorksheet(sheet, { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }], properties: { tabColor: { argb: SHYAM } } });
    const cols = columnsFor(sheet);
    ws.columns = cols.map((c) => ({ header: headerOf(c), key: c.key, width: c.width }));
    const head = ws.getRow(1);
    head.height = 30;
    cols.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      const ro = c.readOnly?.includes(sheet);
      cell.font = { bold: true, color: { argb: ro ? "FF5B6478" : "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ro ? GREY : SHYAM } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.note = `${c.help}${ro ? "\n(Shown only: not read back.)" : ""}\nExample: ${c.example}`;
    });
    const rows = data.products.filter((p) => (sheet === "Boxes") === (p.kind === "bundle"));
    for (const p of rows) {
      ws.addRow({
        sku: p.sku,
        name: p.name,
        adminName: p.adminName ?? "",
        group: p.group ?? "",
        category: p.category ?? "",
        tagline: p.tagline ?? "",
        description: p.description ?? "",
        price: rupees(p.price),
        mrp: p.mrp != null ? rupees(p.mrp) : "",
        cost: rupees(p.cost),
        stock: p.stock ?? "",
        visibility: VISIBILITY_LABEL[p.visibility],
        pinRank: p.pinRank ?? "",
        boost: p.boost,
        featured: p.featured ? "Yes" : "No",
        comingSoon: p.comingSoon ? "Yes" : "No",
        launchAt: istText(p.launchAt),
        photos: p.photos.join("\n"),
        contents: p.contents.map((c) => `${c.sku} x ${c.qty}`).join("\n"),
      });
    }
    // Formats and pick-lists also on 300 empty rows below, so new rows typed there get them too.
    const last = rows.length + 300;
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.type === "money") col.numFmt = "#,##0.##";
      if (c.type === "longtext" || c.type === "photos" || c.type === "contents") col.alignment = { wrapText: true, vertical: "top" };
      if (c.readOnly?.includes(sheet)) col.font = { color: { argb: "FF5B6478" } };
      const list = c.key === "visibility" ? VISIBILITY_CHOICES : c.type === "yesno" ? ["Yes", "No"] : c.key === "group" ? c.choices : null;
      const letter = col.letter;
      for (let r = 2; r <= last; r++) {
        const cell = ws.getCell(`${letter}${r}`);
        if (list) cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${list.join(",")}"`], showErrorMessage: true, errorTitle: c.header, error: `Choose ${list.join(", ")} (or leave empty).` };
        else if (c.key === "category" && data.categories.length) cell.dataValidation = { type: "list", allowBlank: true, formulae: [`Categories!$A$2:$A$${data.categories.length + 1}`], showErrorMessage: false };
      }
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }

  const cats = wb.addWorksheet("Categories");
  cats.columns = [{ header: "Category", key: "c", width: 30 }];
  cats.getRow(1).font = { bold: true };
  data.categories.forEach((c) => cats.addRow({ c }));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function readMe(ws: ExcelJS.Worksheet) {
  ws.columns = [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 70 }, { width: 34 }];
  ws.addRow(["VedicVisa catalogue file"]).font = { bold: true, size: 16, color: { argb: SHYAM } };
  ws.addRow([]);
  const rules = [
    "Each row is one product. The SKU decides which one: a SKU already in the store updates that product, a new SKU creates a new product.",
    "An empty cell means: leave it as it is. Only filled cells change anything.",
    "Nothing is ever deleted by this file. To hide a product, set Visibility to Hidden.",
    "A dash (-) clears an optional value (admin name, category, tagline, description, MRP, pin, launch date). In Stock, a dash stops tracking stock.",
    "Single items go on the Products sheet, boxes and sets on the Boxes sheet.",
    "Box contents: one item per line, as SKU x quantity. Filling it replaces the box's list. Box cost is worked out from its contents.",
    "Upload the file in Admin → Excel. You'll see every change and any problem before anything is saved.",
  ];
  rules.forEach((r, i) => {
    const row = ws.addRow([`${i + 1}.`, r]);
    ws.mergeCells(row.number, 2, row.number, 5);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.height = 30;
  });
  ws.addRow([]);
  const head = ws.addRow(["Column", "Sheets", "Needed", "What it means", "Example"]);
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SHYAM } };
  });
  for (const c of COLUMNS) {
    const row = ws.addRow([c.header, c.sheets.join(", "), c.required === "always" ? "Always" : c.required === "new" ? "New products" : c.readOnly ? "Shown only (boxes)" : "", c.help, c.example]);
    row.alignment = { wrapText: true, vertical: "top" };
    row.getCell(1).font = { bold: true };
    if (row.number % 2) row.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPER } }));
  }
}

// ── Reading an uploaded file ────────────────────────────────

function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // Excel keeps dates without a time zone; exceljs hands them over as UTC wall time.
    return v.toISOString().slice(0, 16).replace("T", " ").replace(/ 00:00$/, "");
  }
  if (typeof v === "object") {
    if ("result" in v) return text(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("hyperlink" in v) return String((v as { text?: string; hyperlink: string }).text ?? v.hyperlink);
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

export async function parseCatalogueWorkbook(buf: ArrayBuffer): Promise<{ rows: RawRow[]; warnings: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const rows: RawRow[] = [];
  const warnings: string[] = [];
  let found = 0;
  for (const sheet of ["Products", "Boxes"] as SheetName[]) {
    const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === sheet.toLowerCase());
    if (!ws) continue;
    found++;
    let headerRow = 0;
    const map = new Map<number, ColKey>();
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (headerRow) return;
      const first = text(row.getCell(1).value).trim();
      if (/^sku\b/i.test(first)) {
        headerRow = n;
        row.eachCell((cell, col) => {
          const c = columnByHeader(sheet, text(cell.value));
          if (c) map.set(col, c.key);
          else if (text(cell.value).trim()) warnings.push(`${sheet}: column “${text(cell.value)}” isn't one the store reads, so it is skipped.`);
        });
      }
    });
    if (!headerRow) {
      warnings.push(`${sheet}: no header row starting with SKU, so the sheet was skipped.`);
      continue;
    }
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n <= headerRow) return;
      const cells: RawRow["cells"] = {};
      let any = false;
      map.forEach((key, col) => {
        const v = text(row.getCell(col).value).trim();
        if (v) {
          cells[key] = v;
          any = true;
        }
      });
      if (any) rows.push({ sheet, row: n, cells });
    });
  }
  if (!found) throw new Error("This doesn't look like the catalogue file: it needs a sheet called Products or Boxes. Download the catalogue to get one.");
  return { rows, warnings };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
