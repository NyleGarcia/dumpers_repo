import { getResourceType } from '../config/resourceTypes'

/** Minimum entries before a category is shown on its own. Smaller groups roll into Miscellaneous. */
export const LORE_MIN_CATEGORY_SIZE = 2

export const COMMODITY_LORE_CATEGORY_ORDER = [
  'Ores & Minerals',
  'Refined Materials',
  'Gems & Hand Mineables',
  'Gases',
  'Contraband',
  'Trade Goods',
  'Medical',
  'Industrial',
  'Other',
] as const

export const ITEM_LORE_CATEGORY_ORDER = [
  'Ship Shields',
  'Ship Coolers',
  'Power Plants',
  'Quantum Drives',
  'Radar & Sensors',
  'Life Support',
  'Ship Weapons',
  'Ship Computers',
  'Ship Modules & Storage',
  'Ship Paints & Liveries',
  'FPS Weapons',
  'Optics & Attachments',
  'Armor & Clothing',
  'Food & Drink',
  'Flair & Collectibles',
  'Salvage & Industrial',
  'Ground Vehicles',
  'Gadgets & Tools',
  'Consumables',
  'Miscellaneous',
] as const

export const LORE_CATEGORY_ORDER = [
  ...COMMODITY_LORE_CATEGORY_ORDER,
  ...ITEM_LORE_CATEGORY_ORDER,
] as const

const SHIP_COMPONENT_CODES: Record<string, (typeof ITEM_LORE_CATEGORY_ORDER)[number]> = {
  shld: 'Ship Shields',
  cool: 'Ship Coolers',
  powr: 'Power Plants',
  qdrv: 'Quantum Drives',
  radr: 'Radar & Sensors',
  life: 'Life Support',
  wepn: 'Ship Weapons',
  comp: 'Ship Computers',
  jump: 'Quantum Drives',
  qint: 'Quantum Drives',
  qsnk: 'Quantum Drives',
}

const ARMOR_KEYWORDS = [
  'armor',
  'flightsuit',
  'helmet',
  'shirt',
  'jacket',
  'pants',
  'gloves',
  'boots',
  'undersuit',
  'monocle',
  'tophat',
  'hat_',
  '_hat',
  'bandana',
  'mask',
  'vest',
  'coat',
  'outfit',
  'bodysuit',
  'backpack',
]

const WEAPON_KEYWORDS = [
  'pistol',
  'rifle',
  'shotgun',
  'sniper',
  'smg',
  'lmg',
  'hmg',
  'launcher',
  'grenade',
  'knife',
  'sword',
  'cannon',
  'repeater',
  'gatling',
]

function getCommodityLoreCategory(resourceKey: string, label: string): string {
  const lowerLabel = label.toLowerCase()

  if (
    lowerLabel.includes('medical') ||
    lowerLabel.includes('medstick') ||
    lowerLabel.includes('kopion') ||
    lowerLabel.includes('molina')
  ) {
    return 'Medical'
  }

  if (
    lowerLabel.includes('refined') ||
    ['diamond', 'silnex', 'neograph', 'thermalfoam'].includes(resourceKey)
  ) {
    return 'Refined Materials'
  }

  switch (getResourceType(resourceKey)) {
    case 'ore':
      return 'Ores & Minerals'
    case 'gem':
      return 'Gems & Hand Mineables'
    case 'gas':
    case 'halogen':
      return 'Gases'
    case 'fuel':
    case 'salvage':
      return 'Industrial'
    case 'contraband':
      return 'Contraband'
    case 'trade_good':
    case 'harvest':
    case 'shop_special':
      return 'Trade Goods'
    default:
      return 'Other'
  }
}

function getComponentCategoryFromLocKey(locKey: string): string | null {
  const upper = locKey.toUpperCase()
  for (const [code, category] of Object.entries(SHIP_COMPONENT_CODES)) {
    const token = code.toUpperCase()
    if (
      upper.includes(`_${token}_`) ||
      upper.includes(`${token}_`) ||
      upper.includes(`_${token}`) ||
      upper.includes(`DESC${token}_`)
    ) {
      return category
    }
  }
  return null
}

function getItemLoreCategory(resourceKey: string, locKey: string): string {
  const stem = resourceKey.toLowerCase()
  const parts = stem.split('_')
  const first = parts[0] ?? stem
  const locCategory = getComponentCategoryFromLocKey(locKey)
  if (locCategory) return locCategory

  if (first === 'food' || first === 'drink') return 'Food & Drink'
  if (first === 'flair' || stem.startsWith('flair')) return 'Flair & Collectibles'
  if (first === 'srvl' || stem.includes('salvage')) return 'Salvage & Industrial'
  if (first === 'cbd') return 'Consumables'

  for (const part of parts) {
    const category = SHIP_COMPONENT_CODES[part]
    if (category) return category
  }

  if (
    stem.includes('_paint_') ||
    stem.includes('paint_') ||
    stem.endsWith('_paint') ||
    stem.includes('_livery')
  ) {
    return 'Ship Paints & Liveries'
  }

  if (
    stem.includes('optics') ||
    stem.includes('optic') ||
    stem.includes('scope') ||
    stem.includes('sight') ||
    stem.includes('_rdot_') ||
    stem.includes('_holo_')
  ) {
    return 'Optics & Attachments'
  }

  if (
    stem.includes('crafting') ||
    stem.includes('storage') ||
    stem.includes('container') ||
    stem.includes('claw') ||
    stem.includes('module') ||
    stem.includes('emitter')
  ) {
    return 'Ship Modules & Storage'
  }

  if (ARMOR_KEYWORDS.some((keyword) => stem.includes(keyword))) {
    return 'Armor & Clothing'
  }

  if (WEAPON_KEYWORDS.some((keyword) => stem.includes(keyword))) {
    return stem.includes('vehicle') || first === 'gv' ? 'Ground Vehicles' : 'FPS Weapons'
  }

  if (
    stem.includes('vehicle') ||
    stem.includes('ground') ||
    first === 'gv' ||
    stem.includes('cyclone') ||
    stem.includes('roc') ||
    stem.includes('nova') ||
    stem.includes('ballista')
  ) {
    return 'Ground Vehicles'
  }

  if (first === 'grin' || stem.includes('multitool') || stem.includes('gadget')) {
    return 'Gadgets & Tools'
  }

  if (locKey.toLowerCase().includes('flbl') || stem.includes('flashlight')) {
    return 'Gadgets & Tools'
  }

  return 'Miscellaneous'
}

export function getGameLoreCategory(
  resourceKey: string,
  label: string,
  locKey: string,
  kind?: 'commodity' | 'item'
): string {
  const inferredKind =
    kind ??
    (locKey.toLowerCase().startsWith('items_commodities_') ||
    locKey.toLowerCase().startsWith('commodity_')
      ? 'commodity'
      : 'item')

  if (inferredKind === 'commodity') {
    return getCommodityLoreCategory(resourceKey, label)
  }

  return getItemLoreCategory(resourceKey, locKey)
}

export function mergeSmallLoreCategories<T>(
  categories: Map<string, T[]>,
  minSize = LORE_MIN_CATEGORY_SIZE,
  fallbackCategory = 'Miscellaneous'
): Map<string, T[]> {
  const merged = new Map<string, T[]>()
  const orphans: T[] = []

  for (const [category, entries] of categories) {
    if (category === fallbackCategory || entries.length >= minSize) {
      const existing = merged.get(category) ?? []
      merged.set(category, [...existing, ...entries])
      continue
    }
    orphans.push(...entries)
  }

  if (orphans.length > 0) {
    merged.set(fallbackCategory, [...(merged.get(fallbackCategory) ?? []), ...orphans])
  }

  return merged
}
