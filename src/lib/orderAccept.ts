import { getResourceLabel } from './blueprintResources'
import type { CustomOrder } from './operations'
import { resolveOrderBlueprintLines } from './orderPricing'

export function getOrderAcceptBlockers(input: {
  order: CustomOrder
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

  for (const item of input.order.items ?? []) {
    const have = input.personalStock[item.resource_key] ?? 0
    if (have < Number(item.quantity)) {
      blockers.push(
        `Need ${getResourceLabel(item.resource_key, input.labelMap)} × ${item.quantity} (have ${have})`
      )
    }
  }

  return blockers
}
