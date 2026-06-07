import type { BlueprintWithSlots } from './blueprintResources'
import { calculateBlueprintDfpForOrder } from './dfp'
import type { CustomOrder, CustomOrderBlueprint } from './operations'

export interface OrderBlueprintLine {
  blueprintId: string
  blueprintTitle: string
  minQuality: number
  quantity: number
  unitDfpAuec: number
  lineDfpAuec: number
}

export function pricingForBlueprintLine(
  blueprint: BlueprintWithSlots,
  minQuality: number,
  quantity: number
): { unitDfpAuec: number; lineDfpAuec: number } {
  const qty = Math.max(1, quantity)
  const dfp = calculateBlueprintDfpForOrder(blueprint, minQuality, qty)
  const unitDfpAuec = Math.round(dfp.total / qty)
  return { unitDfpAuec, lineDfpAuec: dfp.total }
}

export function resolveOrderBlueprintLines(order: CustomOrder): OrderBlueprintLine[] {
  if (order.blueprints && order.blueprints.length > 0) {
    return [...order.blueprints]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row: CustomOrderBlueprint) => ({
        blueprintId: row.blueprint_id,
        blueprintTitle: row.blueprint_title ?? row.blueprint_id,
        minQuality: row.min_quality,
        quantity: row.quantity,
        unitDfpAuec: Number(row.unit_dfp_auec),
        lineDfpAuec: Number(row.line_dfp_auec),
      }))
  }

  if (order.blueprint_id) {
    return [
      {
        blueprintId: order.blueprint_id,
        blueprintTitle: order.title,
        minQuality: order.min_quality,
        quantity: order.quantity,
        unitDfpAuec: Number(order.total_dfp_auec) / Math.max(1, order.quantity),
        lineDfpAuec: Number(order.total_dfp_auec),
      },
    ]
  }

  return []
}

export function orderBlueprintIds(order: CustomOrder): string[] {
  const lines = resolveOrderBlueprintLines(order)
  return lines.map((line) => line.blueprintId)
}

export function orderTotalDfp(order: CustomOrder): number {
  const stored = Number(order.total_dfp_auec)
  if (stored > 0) return stored
  return resolveOrderBlueprintLines(order).reduce((sum, line) => sum + line.lineDfpAuec, 0)
}
