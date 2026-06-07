import type { ResourceInventoryRow } from './operations'
import { roundResourceQuantity } from './resourceQuantity'

export function inventoryLineKey(resourceKey: string, quality: number): string {
  return `${resourceKey}::${quality}`
}

export function buildStockTotalsByResource(
  rows: Pick<ResourceInventoryRow, 'resource_key' | 'quantity'>[]
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    totals[row.resource_key] = roundResourceQuantity(
      (totals[row.resource_key] ?? 0) + Number(row.quantity)
    )
  }
  return totals
}
