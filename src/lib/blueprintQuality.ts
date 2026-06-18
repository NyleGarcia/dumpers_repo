import { DEFAULT_QUALITY, getResourceBands } from './qualityBands'
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

/** Band 4 default per resource (matches PersonalStockAddPanel). */
export function defaultQualityForSlotResource(resourceName: string): number {
  const bands = getResourceBands(resourceName)
  if (bands && bands.length > 0) {
    return bands[3] ?? bands[0]
  }
  return DEFAULT_QUALITY
}

export function buildDefaultSlotQualities(blueprint: BlueprintWithSlots): Record<number, number> {
  const qualities: Record<number, number> = {}
  const slots = blueprint.slots ?? []
  for (let i = 0; i < slots.length; i++) {
    qualities[i] = defaultQualityForSlotResource(resolveSlotResourceName(slots[i]))
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
