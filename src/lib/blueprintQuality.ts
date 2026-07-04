import { DEFAULT_QUALITY, getDefaultBandQuality } from './qualityBands'
import type { BlueprintSlot, BlueprintWithSlots } from './blueprintResources'

export function resolveSlotResourceName(slot: BlueprintSlot | undefined): string {
  const option = slot?.options?.[0]
  return (
    option?.resourceName ||
    option?.entityName ||
    option?.displayName ||
    option?.itemName ||
    ''
  )
}

/** Band 2 default per resource (matches PersonalStockAddPanel). */
export function defaultQualityForSlotResource(resourceName: string): number {
  return getDefaultBandQuality(resourceName)
}

export function buildDefaultSlotQualities(blueprint: BlueprintWithSlots): Record<number, number> {
  const qualities: Record<number, number> = {}
  const slots = blueprint.slots ?? []
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const option = slot?.options?.[0]
    const hasModifiers = (option?.modifiers?.length ?? 0) > 0
    // Modifier simulation uses raw Q (matches in-game crafting curves / SC Crafter).
    if (hasModifiers) {
      qualities[i] = option?.minQuality ?? 1
    } else {
      qualities[i] = defaultQualityForSlotResource(resolveSlotResourceName(slot))
    }
  }
  return qualities
}

export function mergeSlotQualities(
  blueprint: BlueprintWithSlots,
  overrides?: Record<number, number> | null,
): Record<number, number> {
  const defaults = buildDefaultSlotQualities(blueprint)
  if (!overrides) return defaults
  return { ...defaults, ...overrides }
}

export function minSlotQuality(slotQualities: Record<number, number>): number {
  const values = Object.values(slotQualities)
  return values.length > 0 ? Math.min(...values) : DEFAULT_QUALITY
}

export function slotQualitiesToParts(
  slotQualities: Record<number, number>,
): { slotIndex: number; quality: number }[] {
  return Object.entries(slotQualities).map(([idx, quality]) => ({
    slotIndex: Number(idx),
    quality,
  }))
}

export function isUniformSlotQuality(slotQualities: Record<number, number>): boolean {
  const values = Object.values(slotQualities)
  if (values.length <= 1) return true
  return values.every((v) => v === values[0])
}

export function formatSlotQualitySummary(slotQualities: Record<number, number>): string {
  if (isUniformSlotQuality(slotQualities)) {
    return `Q${minSlotQuality(slotQualities)}`
  }
  const values = Object.values(slotQualities)
  return `Q${Math.min(...values)}–Q${Math.max(...values)} mix`
}
