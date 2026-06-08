import { getResourceLabel } from './blueprintResources'
import type { FulfillmentItemRow } from './orderFulfillment'
import type { CustomOrder } from './operations'
import { resolveOrderBlueprintLines } from './orderPricing'
import { formatResourceQuantity } from './resourceQuantity'

export function getOrderAcceptBlockers(input: {
  order: CustomOrder
  fulfillmentItems: FulfillmentItemRow[]
  acquiredBlueprints: Record<string, boolean>
  personalStock: Record<string, number>
  labelMap: Record<string, string>
}): string[] {
  const blockers: string[] = []

  for (const line of resolveOrderBlueprintLines(input.order)) {
    if (!input.acquiredBlueprints[line.blueprintId]) {
      blockers.push(`Missing blueprint: ${line.blueprintTitle}`)
    }
  }

  for (const item of input.fulfillmentItems) {
    const have = input.personalStock[item.resourceKey] ?? 0
    const need = item.quantity
    if (have < need) {
      blockers.push(
        `Need ${getResourceLabel(item.resourceKey, input.labelMap)} × ${formatResourceQuantity(need)} SCU (have ${formatResourceQuantity(have)} SCU)`
      )
    }
  }

  return blockers
}
