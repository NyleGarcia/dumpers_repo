import { getResourceLabel } from './blueprintResources'
import type { CustomOrder } from './operations'
import { orderBlueprintIds } from './orderPricing'

export function getOrderAcceptBlockers(input: {
  order: CustomOrder
  acquiredBlueprints: Record<string, boolean>
  personalStock: Record<string, number>
  labelMap: Record<string, string>
}): string[] {
  const blockers: string[] = []

  for (const bpId of orderBlueprintIds(input.order)) {
    if (!input.acquiredBlueprints[bpId]) {
      blockers.push(`Missing blueprint: ${bpId}`)
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
