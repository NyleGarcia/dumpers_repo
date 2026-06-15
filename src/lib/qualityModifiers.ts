/**
 * Quality modifier calculation utilities for blueprint simulation.
 * Allows users to see how resource quality affects final item stats.
 */

export interface Modifier {
  gameplayProperty: string
  startQuality: number
  endQuality: number
  modifierAtStart: number
  modifierAtEnd: number
}

export interface SlotModifierResult {
  property: string
  propertyLabel: string
  modifier: number
  percentChange: number
}

export interface AggregatedModifier {
  property: string
  propertyLabel: string
  combinedModifier: number
  percentChange: number
  baseValue?: number
  finalValue?: number
}

const PROPERTY_LABELS: Record<string, string> = {
  'Health_Maxhealth': 'Integrity',
  'Shield_Maxhealth': 'Max Shield',
  'Armor_Damagemitigation': 'Damage Mitigation',
  'Armor_Temperaturemin': 'Min Temperature',
  'Armor_Temperaturemax': 'Max Temperature',
  'Armor_Radiationdissipation': 'Radiation Dissipation',
  'Weapon_Damage': 'Damage',
  'Weapon_Recoil_Smoothness': 'Recoil Smoothness',
  'Weapon_Recoil_Handling': 'Recoil Handling',
  'Weapon_Recoil_Kick': 'Recoil Kick',
  'Weapon_Firerate': 'Fire Rate',
  'Itemresource_Coolantgeneration': 'Coolant Generation',
  'Itemresource_Powergeneration': 'Power Generation',
  'Quantum_Speed': 'Quantum Speed',
  'Quantum_Fuelrequirement': 'Fuel Requirement',
  'Radar_Minaimassistdistance': 'Min Aim Assist Distance',
  'Radar_Maxaimassistdistance': 'Max Aim Assist Distance',
  'Weapon_Hullscraping_Efficiency': 'Hull Scraping Efficiency',
  'Weapon_Hullscraping_Radius': 'Hull Scraping Radius',
  'Weapon_Hullscraping_Speed': 'Hull Scraping Speed',
  'Weapon_Tractor_Fullstrengthdist': 'Tractor Full Strength Distance',
  'Weapon_Tractor_Maxdist': 'Tractor Max Distance',
  'Weapon_Tractor_Force': 'Tractor Force',
  'Weapon_Tractor_Maxvolume': 'Tractor Max Volume',
}

export function getPropertyLabel(property: string): string {
  const normalized = property.charAt(0).toUpperCase() + property.slice(1).toLowerCase()
  const key = Object.keys(PROPERTY_LABELS).find(
    k => k.toLowerCase() === property.toLowerCase()
  )
  if (key) return PROPERTY_LABELS[key]
  
  // Fallback: convert snake_case to Title Case
  return property
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Interpolate the modifier value for a given quality within the modifier ranges.
 * Quality ranges are typically 0-500 and 501-1000 with different modifier curves.
 */
export function interpolateModifier(quality: number, modifiers: Modifier[]): number {
  if (!modifiers || modifiers.length === 0) return 1

  // Clamp quality to valid range
  const clampedQuality = Math.max(1, Math.min(1000, quality))

  for (const mod of modifiers) {
    if (clampedQuality >= mod.startQuality && clampedQuality <= mod.endQuality) {
      const range = mod.endQuality - mod.startQuality
      if (range === 0) return mod.modifierAtStart
      
      const position = (clampedQuality - mod.startQuality) / range
      return mod.modifierAtStart + position * (mod.modifierAtEnd - mod.modifierAtStart)
    }
  }

  // If quality is below all ranges, use the first range's start
  const sortedMods = [...modifiers].sort((a, b) => a.startQuality - b.startQuality)
  if (clampedQuality < sortedMods[0].startQuality) {
    return sortedMods[0].modifierAtStart
  }

  // If quality is above all ranges, use the last range's end
  const lastMod = sortedMods[sortedMods.length - 1]
  if (clampedQuality > lastMod.endQuality) {
    return lastMod.modifierAtEnd
  }

  return 1
}

/**
 * Format a modifier value as a percentage change string.
 * 0.8 → "-20.00%", 1.0 → "0.00%", 1.2 → "+20.00%"
 */
export function formatModifierPercent(modifier: number): string {
  const percentChange = (modifier - 1) * 100
  const sign = percentChange >= 0 ? '+' : ''
  return `${sign}${percentChange.toFixed(2)}%`
}

/**
 * Get the color class for a modifier value.
 */
export function getModifierColorClass(modifier: number): string {
  if (modifier < 0.9999) return 'text-red-400'
  if (modifier > 1.0001) return 'text-green-400'
  return 'text-slate-400'
}

/**
 * Calculate all modifier results for a slot at a given quality.
 */
export function calculateSlotModifiers(
  quality: number,
  modifiers: Modifier[] | undefined
): SlotModifierResult[] {
  if (!modifiers || modifiers.length === 0) return []

  // Group modifiers by property
  const byProperty = new Map<string, Modifier[]>()
  for (const mod of modifiers) {
    const key = mod.gameplayProperty.toLowerCase()
    if (!byProperty.has(key)) {
      byProperty.set(key, [])
    }
    byProperty.get(key)!.push(mod)
  }

  const results: SlotModifierResult[] = []
  for (const [property, mods] of byProperty) {
    const modifier = interpolateModifier(quality, mods)
    results.push({
      property: mods[0].gameplayProperty,
      propertyLabel: getPropertyLabel(mods[0].gameplayProperty),
      modifier,
      percentChange: (modifier - 1) * 100,
    })
  }

  return results
}

/**
 * Aggregate modifiers from multiple slots by property.
 * Same properties are multiplied together.
 */
export function aggregateModifiers(
  slotResults: SlotModifierResult[][],
  baseStats?: Record<string, number>
): AggregatedModifier[] {
  const byProperty = new Map<string, { label: string; modifiers: number[]; originalProperty: string }>()

  for (const slotResult of slotResults) {
    for (const result of slotResult) {
      const key = result.property.toLowerCase()
      if (!byProperty.has(key)) {
        byProperty.set(key, { label: result.propertyLabel, modifiers: [], originalProperty: result.property })
      }
      byProperty.get(key)!.modifiers.push(result.modifier)
    }
  }

  const aggregated: AggregatedModifier[] = []
  for (const [property, data] of byProperty) {
    // Multiply all modifiers together
    const combinedModifier = data.modifiers.reduce((acc, m) => acc * m, 1)
    const percentChange = (combinedModifier - 1) * 100

    // Find base stat if available (case-insensitive comparison)
    // vehicleBaseStats uses keys like "Health_MaxHealth" while gameplayProperty uses "Health_Maxhealth"
    const baseKey = Object.keys(baseStats || {}).find(
      k => k.toLowerCase() === property.toLowerCase()
    )
    const baseValue = baseKey ? baseStats![baseKey] : undefined
    const finalValue = baseValue !== undefined ? Math.round(baseValue * combinedModifier) : undefined

    aggregated.push({
      property: data.originalProperty,
      propertyLabel: data.label,
      combinedModifier,
      percentChange,
      baseValue,
      finalValue,
    })
  }

  // Sort by property label
  return aggregated.sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel))
}

/**
 * Format a number with locale-specific thousands separators.
 */
export function formatStatValue(value: number): string {
  return Math.round(value).toLocaleString()
}
