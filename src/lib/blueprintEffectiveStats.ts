import { mergeSlotQualities } from './blueprintQuality'
import type { BlueprintWithSlots } from './blueprintResources'
import {
  aggregateModifiers,
  calculateSlotModifiers,
  type RawModifier,
} from './qualityModifiers'

export interface BlueprintForEffectiveStats extends BlueprintWithSlots {
  vehicleBaseStats?: Record<string, number | null>
  armorBaseStats?: Record<string, number | null>
  weaponBaseStats?: Record<string, number | null>
  slots?: Array<{
    slotDisplayName?: string
    options?: Array<{ modifiers?: RawModifier[] }>
  }>
}

export function mergeBlueprintBaseStats(
  blueprint: BlueprintForEffectiveStats
): Record<string, number> {
  const stats: Record<string, number> = {}
  const allStats = {
    ...blueprint.vehicleBaseStats,
    ...blueprint.armorBaseStats,
    ...blueprint.weaponBaseStats,
  }
  for (const [key, value] of Object.entries(allStats)) {
    if (value !== null && value !== undefined) {
      stats[key] = value
    }
  }
  return stats
}

export function blueprintHasQualityModifiers(blueprint: BlueprintForEffectiveStats): boolean {
  return (
    blueprint.slots?.some((slot) =>
      slot.options?.some((opt) => opt.modifiers && opt.modifiers.length > 0)
    ) ?? false
  )
}

/** Slot qualities from order line, or uniform minQuality when per-slot data is absent. */
export function resolveEffectiveSlotQualities(
  blueprint: BlueprintForEffectiveStats,
  slotQualities?: Record<number, number> | null,
  minQuality?: number
): Record<number, number> {
  if (slotQualities && Object.keys(slotQualities).length > 0) {
    return mergeSlotQualities(blueprint, slotQualities)
  }

  if (minQuality != null && blueprint.slots?.length) {
    const uniform: Record<number, number> = {}
    for (let i = 0; i < blueprint.slots.length; i++) {
      uniform[i] = minQuality
    }
    return uniform
  }

  return mergeSlotQualities(blueprint, slotQualities)
}

export function computeBlueprintEffectiveModifiers(
  blueprint: BlueprintForEffectiveStats,
  slotQualities?: Record<number, number> | null,
  minQuality?: number
) {
  if (!blueprintHasQualityModifiers(blueprint) || !blueprint.slots?.length) {
    return []
  }

  const effectiveQualities = resolveEffectiveSlotQualities(
    blueprint,
    slotQualities,
    minQuality
  )
  const mergedBaseStats = mergeBlueprintBaseStats(blueprint)

  const allSlotModifiers = blueprint.slots.map((slot, idx) => {
    const quality = effectiveQualities[idx] ?? 500
    const modifiers = slot.options?.[0]?.modifiers
    return calculateSlotModifiers(quality, modifiers)
  })

  return aggregateModifiers(allSlotModifiers, mergedBaseStats)
}
