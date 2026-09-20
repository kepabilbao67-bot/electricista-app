import type { SqlExecutor } from "./db";

export interface CatalogPricedLine {
  catalog_item_id?: string | null;
  unit_price: number;
}

export interface CatalogPriceState {
  id: string;
  unit_price: number | null;
  sale_price_pending?: number | boolean | null;
}

export function isSalePricePending(item: CatalogPriceState): boolean {
  return Boolean(item.sale_price_pending);
}

export function canAddCatalogItem(item: CatalogPriceState): boolean {
  return !isSalePricePending(item);
}

export async function findPendingCatalogLine(
  db: SqlExecutor,
  lines: CatalogPricedLine[]
): Promise<string | null> {
  for (const line of lines) {
    if (!line.catalog_item_id) continue;
    const result = await db.execute({
      sql: "SELECT sale_price_pending FROM catalog_items WHERE id = ? LIMIT 1",
      args: [line.catalog_item_id],
    });
    if (result.rows.length > 0 && Boolean(result.rows[0].sale_price_pending)) {
      return line.catalog_item_id;
    }
  }
  return null;
}
