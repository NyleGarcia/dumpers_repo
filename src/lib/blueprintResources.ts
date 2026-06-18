import { isWholeUnitResource } from '../config/resourceTypes'
import { fromMilliScu, toMilliScu } from './resourceQuantity'

export interface BlueprintRequirementOption {
  type?: string
  resourceName?: string
  entityName?: string
  itemName?: string
  displayName?: string
  standardCargoUnits?: number
  quantity?: number
}

export interface BlueprintSlot {
  requiredCount?: number
  options?: BlueprintRequirementOption[]
}

export interface BlueprintWithSlots {
  blueprintName?: string
  file?: string
  categoryName?: string
  subCategoryName?: string
  slots?: BlueprintSlot[]
}

export interface ExtractedBlueprintResource {
  resourceKey: string
  label: string
}

export function slugifyResourceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function extractBlueprintResources(
  blueprints: BlueprintWithSlots[]
): ExtractedBlueprintResource[] {
  const byKey = new Map<string, ExtractedBlueprintResource>()

  for (const blueprint of blueprints) {
    for (const slot of blueprint.slots ?? []) {
      for (const option of slot.options ?? []) {
        const label = option.resourceName || option.entityName || option.displayName || option.itemName
        if (!label) continue

        const resourceKey = slugifyResourceName(label)
        if (!resourceKey) continue

        if (!byKey.has(resourceKey)) {
          byKey.set(resourceKey, { resourceKey, label })
        }
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function buildResourceLabelMap(
  catalog: { resource_key: string; label: string }[]
): Record<string, string> {
  return Object.fromEntries(catalog.map((row) => [row.resource_key, row.label]))
}

export function getResourceLabel(
  resourceKey: string,
  labelMap: Record<string, string>
): string {
  return labelMap[resourceKey] ?? resourceKey
}

export interface BlueprintOrderLineItem {
  resourceKey: string
  label: string
  quantity: number
}

function quantityPerCraftForOption(
  option: BlueprintRequirementOption,
  slotCount: number,
  resourceKey: string
): number {
  const optQty = option.quantity ?? 1
  if (isWholeUnitResource(resourceKey)) {
    return slotCount * optQty
  }
  const units = option.standardCargoUnits ?? 0
  return fromMilliScu(toMilliScu(units) * slotCount * optQty)
}

/** Derive resource requirements from blueprint slots × craft quantity. */
export function extractOrderLineItemsFromBlueprint(
  blueprint: BlueprintWithSlots,
  orderQuantity: number
): BlueprintOrderLineItem[] {
  const craftQty = Math.max(1, orderQuantity)
  const totals = new Map<string, { resourceKey: string; label: string; amount: number }>()

  for (const slot of blueprint.slots ?? []) {
    const slotCount = slot.requiredCount ?? 1
    for (const option of slot.options ?? []) {
      if (option.type && option.type !== 'resource') continue

      const label = option.resourceName || option.entityName || option.displayName || option.itemName
      if (!label) continue

      const resourceKey = slugifyResourceName(label)
      if (!resourceKey) continue

      const add = quantityPerCraftForOption(option, slotCount, resourceKey) * craftQty
      if (add <= 0) continue

      const existing = totals.get(resourceKey)
      if (existing) {
        existing.amount += add
      } else {
        totals.set(resourceKey, { resourceKey, label, amount: add })
      }
    }
  }

  return [...totals.values()]
    .map((row) => ({
      resourceKey: row.resourceKey,
      label: row.label,
      quantity: isWholeUnitResource(row.resourceKey) ? Math.trunc(row.amount) : row.amount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Aggregate resource lines across multiple blueprint × quantity rows. */
export function extractOrderLineItemsFromBlueprints(
  lines: { blueprint: BlueprintWithSlots; quantity: number }[]
): BlueprintOrderLineItem[] {
  const totals = new Map<string, { resourceKey: string; label: string; amount: number }>()

  for (const { blueprint, quantity } of lines) {
    for (const item of extractOrderLineItemsFromBlueprint(blueprint, quantity)) {
      const existing = totals.get(item.resourceKey)
      if (existing) {
        existing.amount += item.quantity
      } else {
        totals.set(item.resourceKey, {
          resourceKey: item.resourceKey,
          label: item.label,
          amount: item.quantity,
        })
      }
    }
  }

  return [...totals.values()]
    .map((row) => ({
      resourceKey: row.resourceKey,
      label: row.label,
      quantity: isWholeUnitResource(row.resourceKey) ? Math.trunc(row.amount) : row.amount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
