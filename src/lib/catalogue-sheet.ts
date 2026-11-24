/**
 * The catalogue Excel file: one definition used for the format guide (Admin → Excel), the download, the upload
 * parser and the server's checks, so they can never disagree.
 *
 * Rules (the owner's): rows are matched by SKU. A known SKU is updated, a new SKU creates a product. An empty cell
 * means "leave as it is". Nothing is ever deleted by a file; a dash (-) clears an optional value.
 */

export type SheetName = "Products" | "Boxes";
export type ColKey =
  | "sku"
  | "name"
  | "adminName"
  | "group"
  | "category"
  | "tagline"
  | "description"
  | "price"
  | "mrp"
  | "cost"
  | "stock"
  | "visibility"
  | "pinRank"
  | "boost"
  | "featured"
  | "comingSoon"
  | "launchAt"
  | "photos"
  | "contents";

export type ColType = "sku" | "text" | "longtext" | "money" | "int" | "choice" | "yesno" | "date" | "photos" | "contents";

export type Column = {
  key: ColKey;
  header: string;
  sheets: SheetName[];
  type: ColType;
  /** "always": every row needs it. "new": needed only when the SKU is new. */
  required?: "always" | "new";
  /** A dash (-) in this column clears the value. */
  clearable?: boolean;
  /** Shown in the file but not read back (worked out by the store). */
  readOnly?: SheetName[];
  width: number;
  help: string;
  example: string;
  choices?: string[];
};

export const VISIBILITY_CHOICES = ["In store", "Hidden", "Packing"];
export const VISIBILITY_VALUE: Record<string, "public" | "hidden" | "internal"> = { "in store": "public", hidden: "hidden", packing: "internal", public: "public", internal: "internal" };
export const VISIBILITY_LABEL = { public: "In store", hidden: "Hidden", internal: "Packing" } as const;

export const COLUMNS: Column[] = [
  { key: "sku", header: "SKU", sheets: ["Products", "Boxes"], type: "sku", required: "always", width: 22, help: "The product's code. It decides which product the row is: a code already in the store updates that product, a new code creates one. Letters, numbers and dashes.", example: "VV-TULSI-JAP-MALA" },
  { key: "name", header: "Name", sheets: ["Products", "Boxes"], type: "text", required: "new", width: 30, help: "The name shoppers see.", example: "Tulsi Jap Mala" },
  { key: "adminName", header: "Admin name", sheets: ["Products", "Boxes"], type: "text", clearable: true, width: 24, help: "Only you see this, in the admin. A dash clears it.", example: "Tulsi mala, 108 beads, Mathura batch" },
  { key: "group", header: "Box group", sheets: ["Boxes"], type: "text", width: 18, help: "Boxes in the same group are shown together in the store.", example: "Bhakti Boxes", choices: ["Bhakti Boxes", "Japa Sets", "Shringar Kits"] },
  { key: "category", header: "Category", sheets: ["Products", "Boxes"], type: "text", clearable: true, width: 20, help: "A new category name is created for you. A dash removes the category.", example: "Jap Mala" },
  { key: "tagline", header: "Tagline", sheets: ["Products", "Boxes"], type: "text", clearable: true, width: 34, help: "One line under the name. A dash clears it.", example: "Your first step into daily japa" },
  { key: "description", header: "Description", sheets: ["Products", "Boxes"], type: "longtext", clearable: true, width: 50, help: "The product page text. A dash clears it.", example: "Hand-knotted Tulsi beads from Vrindavan…" },
  { key: "price", header: "Price ₹", sheets: ["Products", "Boxes"], type: "money", required: "new", width: 11, help: "Selling price in rupees.", example: "500" },
  { key: "mrp", header: "MRP ₹", sheets: ["Products", "Boxes"], type: "money", clearable: true, width: 11, help: "Struck-through price. Shown only when higher than the price. A dash removes it.", example: "650" },
  { key: "cost", header: "Cost ₹", sheets: ["Products", "Boxes"], type: "money", readOnly: ["Boxes"], width: 11, help: "What one unit costs you. For boxes it is worked out from the contents, so it is only shown.", example: "120" },
  { key: "stock", header: "Stock", sheets: ["Products", "Boxes"], type: "int", clearable: true, width: 9, help: "Units in hand. A number sets the count (recorded in the stock ledger). A dash stops tracking stock. Boxes usually leave this empty: they follow their items.", example: "40" },
  { key: "visibility", header: "Visibility", sheets: ["Products", "Boxes"], type: "choice", choices: VISIBILITY_CHOICES, width: 12, help: "In store, Hidden (not shown) or Packing (packing material, never sold alone). New products default to Hidden.", example: "In store" },
  { key: "pinRank", header: "Pin position", sheets: ["Products", "Boxes"], type: "int", clearable: true, width: 11, help: "1 shows first in the shop. A dash unpins.", example: "1" },
  { key: "boost", header: "Trending boost", sheets: ["Products", "Boxes"], type: "int", width: 12, help: "Extra trending points (one sale = 10).", example: "0" },
  { key: "featured", header: "Featured", sheets: ["Products", "Boxes"], type: "yesno", width: 10, help: "Yes or No.", example: "No", choices: ["Yes", "No"] },
  { key: "comingSoon", header: "Launching soon", sheets: ["Products", "Boxes"], type: "yesno", width: 12, help: "Yes shows a Launching soon tag and stops sales until the launch date.", example: "No", choices: ["Yes", "No"] },
  { key: "launchAt", header: "Launch date", sheets: ["Products", "Boxes"], type: "date", clearable: true, width: 18, help: "When it goes on sale by itself, India time (2026-12-25 10:00). A dash clears it.", example: "2026-12-25 10:00" },
  { key: "photos", header: "Photos", sheets: ["Products", "Boxes"], type: "photos", width: 40, help: "Photo links, one per line (the first is the cover). If filled, it replaces the photo list. Upload new photos in the product editor and copy their links.", example: "https://media.vedicvisa.com/products/2026/11/abc.jpg" },
  { key: "contents", header: "Contents", sheets: ["Boxes"], type: "contents", width: 40, help: "What goes in the box: one item per line as SKU x quantity. If filled, it replaces the box's contents. Include packing items too, so cost and stock stay right.", example: "VV-TULSI-JAP-MALA x 1\nVV-GOPI-CHANDAN x 2" },
];

export const columnsFor = (sheet: SheetName) => COLUMNS.filter((c) => c.sheets.includes(sheet));
export const headerOf = (c: Column) => (c.required === "always" ? `${c.header} *` : c.header);
const norm = (s: string) => s.toLowerCase().replace(/[*₹()]/g, "").replace(/\s+/g, " ").trim();
export const columnByHeader = (sheet: SheetName, header: string) => columnsFor(sheet).find((c) => norm(c.header) === norm(header));

/** One row read from the file: raw cell text by column, exactly as typed (trimmed). */
export type RawRow = { sheet: SheetName; row: number; cells: Partial<Record<ColKey, string>> };

export const ROW_LIMIT = 2000;
