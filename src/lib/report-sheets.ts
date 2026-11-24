/** The sheets the owner can tick before downloading the stock and sales report (Admin → Excel → Download). */
export const REPORT_SHEETS = [
  { key: "summary", label: "Summary", group: "Sales", needs: "sales" },
  { key: "monthly", label: "Monthly sales", group: "Sales", needs: "sales" },
  { key: "yearly", label: "Yearly sales", group: "Sales", needs: "sales" },
  { key: "products", label: "Product analytics", group: "Analytics", needs: "sales" },
  { key: "categories", label: "Category analytics", group: "Analytics", needs: "sales" },
  { key: "states", label: "State analytics", group: "Analytics", needs: "sales" },
  { key: "cities", label: "City analytics", group: "Analytics", needs: "sales" },
  { key: "offers", label: "Coupons and offers", group: "Analytics", needs: "sales" },
  { key: "times", label: "Weekdays and hours", group: "Analytics", needs: "sales" },
  { key: "stock", label: "Product stock (whole period)", group: "Stock", needs: "stock" },
  { key: "stockMonthly", label: "Product stock by month", group: "Stock", needs: "stock" },
  { key: "ledger", label: "Stock ledger", group: "Stock", needs: "stock" },
  { key: "orders", label: "Orders", group: "Lists", needs: "sales" },
  { key: "lines", label: "Order lines", group: "Lists", needs: "sales" },
] as const;
export type ReportSheet = (typeof REPORT_SHEETS)[number]["key"];
/** Which data the chosen sheets need, so the server only reads that. Stock sheets also show units sold. */
export const reportNeeds = (sheets: Iterable<ReportSheet>) => {
  const set = new Set(sheets);
  const stock = REPORT_SHEETS.some((s) => s.needs === "stock" && set.has(s.key));
  const sales = REPORT_SHEETS.some((s) => s.needs === "sales" && set.has(s.key)) || stock;
  return { stock, sales };
};
