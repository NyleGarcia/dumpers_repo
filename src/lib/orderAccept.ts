import type { CustomOrder } from './operations'
import { resolveOrderBlueprintLines } from './orderPricing'

export function getOrderBlueprintAcceptBlockers(input: {
  order: CustomOrder
  acquiredBlueprints: Record<string, boolean>
}): string[] {
  const blockers: string[] = []

  for (const line of resolveOrderBlueprintLines(input.order)) {
    if (!input.acquiredBlueprints[line.blueprintId]) {
      blockers.push(`Missing blueprint: ${line.blueprintTitle}`)
    }
  }

  return blockers
}

export function fulfillerHasAllOrderBlueprints(
  order: CustomOrder,
  acquiredBlueprints: Record<string, boolean>
): boolean {
  return getOrderBlueprintAcceptBlockers({ order, acquiredBlueprints }).length === 0
}

/** Blueprint ownership only — stock is checked at craft completion, not accept. */
export const getOrderAcceptBlockers = getOrderBlueprintAcceptBlockers
