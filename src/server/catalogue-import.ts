/**
 * Catalogue upload (Admin → Excel): rows matched by SKU. Known SKU → update only the filled cells; new SKU → create.
 * Never deletes. First a check (plan) shows every change and every problem; nothing is written until the owner
 * applies, and a file with problems can't be applied. Applying runs in one transaction.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { bundleItems, categories, products, type Product } from "@/db/schema";
import { COLUMNS, VISIBILITY_LABEL, VISIBILITY_VALUE, type ColKey, type RawRow, type SheetName } from "@/lib/catalogue-sheet";
import { inr, slugify } from "@/lib/utils";
import { setStock } from "./stock";

export type FieldChange = { field: string; from: string; to: string };
export type PlanRow = { sheet: SheetName; row: number; sku: string; name: string; action: "create" | "update" | "same" | "error"; changes: FieldChange[]; errors: string[] };
export type ImportPlan = { rows: PlanRow[]; counts: { create: number; update: number; same: number; error: number }; newCategories: string[]; applied: boolean };

type Patch = Partial<{
  name: string;
  adminName: string | null;
  bundleGroup: string | null;
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
  launchAt: Date | null;
  images: string[];
  contents: { sku: string; qty: number }[];
}>;

const LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.header])) as Record<ColKey, string>;
const IST = 5.5 * 3600_000;

type Bad = { error: string };
const bad = (error: string): Bad => ({ error });
const isBad = (v: unknown): v is Bad => !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && "error" in v;
const normSku = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "-");
const isDash = (s: string) => /^[-–—]$/.test(s.trim());

function money(s: string): number | Bad {
  const t = s.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return bad(`“${s}” is not an amount in rupees`);
  return Math.round(parseFloat(t) * 100);
}
function int(s: string, min: number, max: number): number | Bad {
  const t = s.replace(/,/g, "").trim();
  if (!/^-?\d+$/.test(t)) return bad(`“${s}” is not a whole number`);
  const n = parseInt(t, 10);
  return n < min || n > max ? bad(`${n} is outside ${min} to ${max}`) : n;
}
function yesno(s: string): boolean | Bad {
  const t = s.trim().toLowerCase();
  if (["yes", "y", "true", "1", "haan"].includes(t)) return true;
  if (["no", "n", "false", "0", "nahi"].includes(t)) return false;
  return bad(`“${s}” should be Yes or No`);
}
function istDate(s: string): Date | Bad {
  const t = s.trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) - IST);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? bad(`“${s}” is not a date like 2026-12-25 10:00`) : d;
}
const showDate = (d: Date | null) => (d ? new Date(d.getTime() + IST).toISOString().slice(0, 16).replace("T", " ") : "");
const safeUrl = (u: string) => /^https:\/\/[^\s"'<>]+$/.test(u) || /^\/(?!\/)[\w\-./]+$/.test(u);

export async function importCatalogue(db: DB, rows: RawRow[], opts: { apply: boolean; userId: number }): Promise<ImportPlan> {
  const [all, cats, comps] = await Promise.all([
    db.select().from(products),
    db.select().from(categories),
    db.select({ bundleId: bundleItems.bundleId, productId: bundleItems.productId, qty: bundleItems.qty }).from(bundleItems),
  ]);
  const bySku = new Map(all.map((p) => [p.sku.toUpperCase(), p]));
  const skuById = new Map(all.map((p) => [p.id, p.sku.toUpperCase()]));
  const catById = new Map(cats.map((c) => [c.id, c.name]));
  const catByName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
  const newCategories = new Set<string>();

  // SKUs this file creates, so boxes can list new items in their contents.
  const fileSkus = new Map<string, SheetName>();
  for (const r of rows) {
    const sku = normSku(r.cells.sku ?? "");
    if (sku && !bySku.has(sku) && !fileSkus.has(sku)) fileSkus.set(sku, r.sheet);
  }

  const seen = new Set<string>();
  const plans: (PlanRow & { patch: Patch; existing?: Product })[] = [];

  for (const r of rows) {
    const c = r.cells;
    const errors: string[] = [];
    const sku = normSku(c.sku ?? "");
    const existing = bySku.get(sku);
    const name = c.name?.trim() || existing?.name || "";
    if (!sku) errors.push("SKU is empty");
    else if (!/^[A-Z0-9][A-Z0-9\-_.]{1,39}$/.test(sku)) errors.push(`SKU “${c.sku}” should be 2 to 40 letters, numbers or dashes`);
    else if (seen.has(sku)) errors.push(`SKU ${sku} appears more than once in the file`);
    seen.add(sku);
    if (existing && (existing.kind === "bundle") !== (r.sheet === "Boxes")) errors.push(existing.kind === "bundle" ? `${sku} is a box: put it on the Boxes sheet` : `${sku} is a single product: put it on the Products sheet`);

    const patch: Patch = {};
    const take = (key: ColKey, fn: (v: string) => unknown) => {
      const raw = c[key];
      if (raw === undefined || raw.trim() === "") return;
      const col = COLUMNS.find((x) => x.key === key)!;
      if (col.readOnly?.includes(r.sheet)) return;
      if (isDash(raw)) {
        if (col.clearable) (patch as Record<string, unknown>)[key === "category" ? "category" : key] = null;
        else errors.push(`${LABEL[key]} can't be cleared with a dash`);
        return;
      }
      const v = fn(raw.trim());
      if (isBad(v)) errors.push(`${LABEL[key]}: ${v.error}`);
      else (patch as Record<string, unknown>)[key] = v;
    };
    take("name", (v) => v.slice(0, 120));
    take("adminName", (v) => v.slice(0, 120));
    if (r.sheet === "Boxes") take("group", (v) => v.slice(0, 60));
    take("category", (v) => v.slice(0, 60));
    take("tagline", (v) => v.slice(0, 140));
    take("description", (v) => v.slice(0, 4000));
    take("price", money);
    take("mrp", money);
    take("cost", money);
    take("stock", (v) => int(v, 0, 1_000_000));
    take("visibility", (v) => VISIBILITY_VALUE[v.toLowerCase()] ?? bad(`“${v}” should be In store, Hidden or Packing`));
    take("pinRank", (v) => int(v, 1, 999));
    take("boost", (v) => int(v, -1000, 1000));
    take("featured", yesno);
    take("comingSoon", yesno);
    take("launchAt", istDate);
    take("photos", (v) => {
      const list = v.split(/[\n|,]+/).map((s) => s.trim()).filter(Boolean);
      const wrong = list.find((u) => !safeUrl(u));
      return wrong ? bad(`“${wrong}” is not a photo link (https://…)`) : list.slice(0, 24);
    });
    if (r.sheet === "Boxes")
      take("contents", (v) => {
        const items: { sku: string; qty: number }[] = [];
        for (const line of v.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean)) {
          const m = /^(.+?)(?:\s*[x×*]\s*(\d+))?$/i.exec(line);
          const s = normSku(m?.[1] ?? "");
          const qty = m?.[2] ? parseInt(m[2], 10) : 1;
          if (!s) continue;
          if (s === sku) return bad("a box can't contain itself");
          if (!bySku.has(s) && !fileSkus.has(s)) return bad(`item ${s} is not in the store or this file`);
          if (qty < 1 || qty > 50) return bad(`quantity for ${s} should be 1 to 50`);
          const same = items.find((i) => i.sku === s);
          if (same) same.qty += qty;
          else items.push({ sku: s, qty });
        }
        return items.length ? items : bad("no items listed");
      });
    // Rename the group key used by the patch
    if ("group" in patch) {
      patch.bundleGroup = (patch as { group?: string | null }).group ?? null;
      delete (patch as { group?: unknown }).group;
    }

    if (!existing) {
      if (!c.name?.trim()) errors.push("Name is needed for a new product");
      if (patch.price === undefined) errors.push("Price is needed for a new product");
    }
    if (patch.category && !catByName.has(patch.category.toLowerCase())) newCategories.add(patch.category);

    // What actually changes, in words.
    const changes: FieldChange[] = [];
    const cmp = (field: string, from: string, to: string) => from !== to && changes.push({ field, from, to });
    const p = existing;
    if (patch.name !== undefined) cmp("Name", p?.name ?? "", patch.name);
    if (patch.adminName !== undefined) cmp("Admin name", p?.adminName ?? "", patch.adminName ?? "");
    if (patch.bundleGroup !== undefined) cmp("Box group", p?.bundleGroup ?? "", patch.bundleGroup ?? "");
    if (patch.category !== undefined) cmp("Category", p?.categoryId ? (catById.get(p.categoryId) ?? "") : "", patch.category ?? "");
    if (patch.tagline !== undefined) cmp("Tagline", p?.tagline ?? "", patch.tagline ?? "");
    if (patch.description !== undefined) cmp("Description", p?.description ?? "", patch.description ?? "");
    if (patch.price !== undefined) cmp("Price", p ? inr(p.price) : "", inr(patch.price));
    if (patch.mrp !== undefined) cmp("MRP", p?.mrp != null ? inr(p.mrp) : "", patch.mrp != null ? inr(patch.mrp) : "");
    if (patch.cost !== undefined) cmp("Cost", p ? inr(p.cost) : "", inr(patch.cost));
    if (patch.stock !== undefined) cmp("Stock", p?.stock != null ? String(p.stock) : p ? "not tracked" : "", patch.stock != null ? String(patch.stock) : "not tracked");
    if (patch.visibility !== undefined) cmp("Visibility", p ? VISIBILITY_LABEL[p.visibility] : "", VISIBILITY_LABEL[patch.visibility]);
    if (patch.pinRank !== undefined) cmp("Pin position", p?.pinRank != null ? String(p.pinRank) : "", patch.pinRank != null ? String(patch.pinRank) : "");
    if (patch.boost !== undefined) cmp("Trending boost", p ? String(p.boost) : "", String(patch.boost));
    if (patch.featured !== undefined) cmp("Featured", p ? (p.featured ? "Yes" : "No") : "", patch.featured ? "Yes" : "No");
    if (patch.comingSoon !== undefined) cmp("Launching soon", p ? (p.comingSoon ? "Yes" : "No") : "", patch.comingSoon ? "Yes" : "No");
    if (patch.launchAt !== undefined) cmp("Launch date", showDate(p?.launchAt ?? null), showDate(patch.launchAt));
    if (patch.images !== undefined || (patch as { photos?: string[] }).photos !== undefined) {
      patch.images = (patch as { photos?: string[] }).photos ?? patch.images;
      delete (patch as { photos?: unknown }).photos;
      const before = p?.images ?? [];
      if (JSON.stringify(before) !== JSON.stringify(patch.images)) cmp("Photos", `${before.length} photos`, `${patch.images!.length} photos`);
    }
    if (patch.contents !== undefined) {
      const before = p ? comps.filter((x) => x.bundleId === p.id).map((x) => `${skuById.get(x.productId)} x ${x.qty}`).sort().join(", ") : "";
      const after = patch.contents.map((x) => `${x.sku} x ${x.qty}`).sort().join(", ");
      cmp("Contents", before, after);
    }

    const action: PlanRow["action"] = errors.length ? "error" : !existing ? "create" : changes.length ? "update" : "same";
    plans.push({ sheet: r.sheet, row: r.row, sku, name, action, changes, errors, patch, existing });
  }

  const counts = { create: 0, update: 0, same: 0, error: 0 };
  for (const p of plans) counts[p.action]++;
  const result: ImportPlan = { rows: plans.map(({ patch: _p, existing: _e, ...rest }) => rest), counts, newCategories: [...newCategories], applied: false };
  if (!opts.apply || counts.error > 0 || counts.create + counts.update === 0) return result;

  // ── Apply, all or nothing ──
  await db.transaction(async (tx) => {
    const catId = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));
    const ensureCat = async (name: string | null | undefined) => {
      if (!name) return null;
      const key = name.toLowerCase();
      if (catId.has(key)) return catId.get(key)!;
      let slug = slugify(name) || "category";
      for (let i = 2; (await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1)).length; i++) slug = `${slugify(name)}-${i}`;
      const [row] = await tx.insert(categories).values({ name, slug }).returning();
      catId.set(key, row.id);
      return row.id;
    };
    const usedSlugs = new Set(all.map((p) => p.slug));
    const uniqueSlug = (base: string) => {
      let s = base || "product";
      for (let i = 2; usedSlugs.has(s); i++) s = `${base}-${i}`;
      usedSlugs.add(s);
      return s;
    };
    const idBySku = new Map(all.map((p) => [p.sku.toUpperCase(), p.id]));
    const costChanged = new Set<number>();
    const contentsChanged = new Set<number>();

    const fields = async (patch: Patch) => {
      const f: Partial<typeof products.$inferInsert> = {};
      if (patch.name !== undefined) f.name = patch.name;
      if (patch.adminName !== undefined) f.adminName = patch.adminName && patch.adminName !== patch.name ? patch.adminName : null;
      if (patch.bundleGroup !== undefined) f.bundleGroup = patch.bundleGroup;
      if (patch.category !== undefined) f.categoryId = await ensureCat(patch.category);
      if (patch.tagline !== undefined) f.tagline = patch.tagline;
      if (patch.description !== undefined) f.description = patch.description;
      if (patch.price !== undefined) f.price = patch.price;
      if (patch.mrp !== undefined) f.mrp = patch.mrp;
      if (patch.cost !== undefined) f.cost = patch.cost;
      if (patch.visibility !== undefined) f.visibility = patch.visibility;
      if (patch.pinRank !== undefined) f.pinRank = patch.pinRank;
      if (patch.boost !== undefined) f.boost = patch.boost;
      if (patch.featured !== undefined) f.featured = patch.featured;
      if (patch.comingSoon !== undefined) f.comingSoon = patch.comingSoon;
      if (patch.launchAt !== undefined) f.launchAt = patch.launchAt;
      if (patch.images !== undefined) f.images = patch.images;
      return f;
    };

    // 1. New products first (boxes may list them), then updates.
    for (const p of plans.filter((x) => x.action === "create")) {
      const f = await fields(p.patch);
      const [row] = await tx
        .insert(products)
        .values({ ...f, sku: p.sku, name: p.patch.name!, price: p.patch.price!, slug: uniqueSlug(slugify(p.patch.name!)), kind: p.sheet === "Boxes" ? "bundle" : "single", visibility: p.patch.visibility ?? "hidden", stock: null })
        .returning({ id: products.id });
      idBySku.set(p.sku, row.id);
      if (p.patch.cost !== undefined) costChanged.add(row.id);
    }
    for (const p of plans.filter((x) => x.action === "update")) {
      const f = await fields(p.patch);
      if (Object.keys(f).length) await tx.update(products).set({ ...f, updatedAt: new Date() }).where(eq(products.id, p.existing!.id));
      if (p.patch.cost !== undefined && p.patch.cost !== p.existing!.cost) costChanged.add(p.existing!.id);
    }
    // 2. Box contents (replace the list when given).
    for (const p of plans.filter((x) => (x.action === "create" || x.action === "update") && x.patch.contents)) {
      const id = idBySku.get(p.sku)!;
      await tx.delete(bundleItems).where(eq(bundleItems.bundleId, id));
      await tx.insert(bundleItems).values(p.patch.contents!.map((it) => ({ bundleId: id, productId: idBySku.get(it.sku)!, qty: it.qty })));
      contentsChanged.add(id);
    }
    // 3. Stock counts, through the ledger.
    for (const p of plans.filter((x) => (x.action === "create" || x.action === "update") && x.patch.stock !== undefined)) {
      await setStock(tx, idBySku.get(p.sku)!, p.patch.stock ?? null, opts.userId, "Stock count set from Excel");
    }
    // 4. Box costs follow their contents: boxes whose contents or item costs changed are worked out again.
    const touched = await tx
      .select({ bundleId: bundleItems.bundleId })
      .from(bundleItems)
      .where(costChanged.size ? inArray(bundleItems.productId, [...costChanged]) : sql`false`);
    const boxes = new Set([...contentsChanged, ...touched.map((t) => t.bundleId)]);
    for (const id of boxes) {
      const [{ total }] = await tx
        .select({ total: sql<number>`coalesce(sum(${products.cost} * ${bundleItems.qty}), 0)`.mapWith(Number) })
        .from(bundleItems)
        .innerJoin(products, eq(products.id, bundleItems.productId))
        .where(and(eq(bundleItems.bundleId, id)));
      await tx.update(products).set({ cost: total, updatedAt: new Date() }).where(eq(products.id, id));
    }
  });
  return { ...result, applied: true };
}
