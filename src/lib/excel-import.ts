/**
 * Imports the VedicVisa product sheet (same layout as data/VedicvisaStore.xlsx):
 *  - Columns A–G: SKU, Product Name, Category, Cost ₹, Selling Price ₹, Profit, Margin
 *  - From column H: one 4-column block per bundle (PRODUCT INCLUDED, Included, PP, SP).
 *    Row above the header holds the bundle name, the row above that the group (BOXES / JAPA SET / Shringar Kit).
 *  - Under the product rows, a row labelled "MRP" / "SP" holds each bundle's MRP and selling price.
 * Products are matched by name (case-insensitive). Existing descriptions, images, stock and visibility are kept.
 */
import ExcelJS from "exceljs";
import { slugify } from "./utils";


type Cell = string | number | boolean | null;

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if (v instanceof Date) return v.toISOString();
    return null;
  }
  return v as Cell;
}

const str = (c: Cell) => (c === null ? "" : String(c).trim());
const num = (c: Cell) => {
  const n = typeof c === "number" ? c : parseFloat(str(c));
  return Number.isFinite(n) ? n : null;
};
const titleCase = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").trim().replace(/\b\w/g, (m) => m.toUpperCase());

export type ParsedProduct = { sku: string; name: string; category: string; cost: number; price: number };
export type ParsedBundle = {
  name: string;
  group: string;
  items: string[];
  mrp: number | null;
  price: number | null;
};
export type ParsedSheet = { products: ParsedProduct[]; bundles: ParsedBundle[]; warnings: string[] };

export async function parseWorkbook(buf: ArrayBuffer | Buffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no sheets.");

  const rows: Cell[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const arr: Cell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => (arr[col - 1] = cellValue(cell.value)));
    rows[n - 1] = arr;
  });
  const at = (r: number, c: number): Cell => rows[r]?.[c] ?? null;

  const headerRow = rows.findIndex((r) => r && str(r[0]).toLowerCase().startsWith("sku"));
  if (headerRow < 0) throw new Error('Could not find the header row (first column "SKU / Code").');

  const warnings: string[] = [];
  const parsedProducts: ParsedProduct[] = [];
  const productRows: { row: number; name: string }[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const name = str(at(r, 1));
    const price = num(at(r, 4));
    if (!name || price === null) continue;
    parsedProducts.push({
      sku: str(at(r, 0)) || "VV-" + slugify(name).toUpperCase(),
      name,
      category: str(at(r, 2)) || "Other",
      cost: num(at(r, 3)) ?? 0,
      price,
    });
    productRows.push({ row: r, name });
  }

  // Bundle blocks
  const header = rows[headerRow] ?? [];
  const bundles: ParsedBundle[] = [];
  let group = "";
  for (let c = 7; c < header.length; c++) {
    const g = str(at(headerRow - 2, c));
    if (g) group = g;
    if (str(header[c]).toLowerCase() !== "product included") continue;
    const rawName = str(at(headerRow - 1, c));
    if (!rawName) continue;
    const groupTitle = titleCase(group || "Bundles");
    const name = rawName.length <= 2 ? `${groupTitle} ${rawName.toUpperCase()}` : titleCase(rawName).replace(/\bKit Diy( Set)?\b/i, "Kit (DIY)");
    const items = productRows
      .filter((p) => at(p.row, c + 1) === true || str(at(p.row, c + 1)).toLowerCase() === "true")
      .map((p) => p.name);

    // MRP / SP: find a row where this block has the "MRP" label in column c+2
    let mrp: number | null = null;
    let price: number | null = null;
    for (let r = headerRow + 1; r < rows.length - 1; r++) {
      if (str(at(r, c + 2)).toUpperCase() === "MRP") {
        mrp = num(at(r + 1, c + 2));
        price = num(at(r + 1, c + 3));
        break;
      }
    }
    if (price === null) warnings.push(`${name}: no selling price found in the MRP/SP rows.`);
    bundles.push({ name, group: groupTitle === "Boxes" ? "Bhakti Boxes" : groupTitle.replace(/Set$/, "Sets").replace(/Kit$/, "Kits"), items, mrp, price });
  }
  return { products: parsedProducts, bundles, warnings };
}

