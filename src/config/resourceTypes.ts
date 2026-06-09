import { EXTRA_CATALOG_RESOURCE_KEYS, isSalvageResource } from './extraResources'

function slugifyResourceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export type ResourceType = 'ore' | 'gem' | 'harvest' | 'shop_special' | 'salvage'

const GEM_RESOURCE_KEYS = new Set([
  'aphorite',
  'beradom',
  'carinite',
  'dolivine',
  'feynmaline',
  'glacosite',
  'hadanite',
  'janalite',
  'sadaryx',
])

const HARVEST_RESOURCE_KEYS = new Set(['yormandi_eye'])

const SHOP_SPECIAL_RESOURCE_KEYS = new Set(['saldynium_ore'])

/** Whole-unit materials — gems, harvest, and shop specials (never fractional). */
export function isWholeUnitResource(resourceKey: string): boolean {
  return (
    GEM_RESOURCE_KEYS.has(resourceKey) ||
    HARVEST_RESOURCE_KEYS.has(resourceKey) ||
    SHOP_SPECIAL_RESOURCE_KEYS.has(resourceKey)
  )
}

export function isGemResource(resourceKey: string): boolean {
  return GEM_RESOURCE_KEYS.has(resourceKey)
}

export function isHarvestResource(resourceKey: string): boolean {
  return HARVEST_RESOURCE_KEYS.has(resourceKey)
}

export function isShopSpecialResource(resourceKey: string): boolean {
  return SHOP_SPECIAL_RESOURCE_KEYS.has(resourceKey)
}

export function getResourceType(resourceKey: string): ResourceType {
  if (isSalvageResource(resourceKey) || EXTRA_CATALOG_RESOURCE_KEYS.has(resourceKey)) {
    return 'salvage'
  }
  if (HARVEST_RESOURCE_KEYS.has(resourceKey)) return 'harvest'
  if (SHOP_SPECIAL_RESOURCE_KEYS.has(resourceKey)) return 'shop_special'
  if (GEM_RESOURCE_KEYS.has(resourceKey)) return 'gem'
  return 'ore'
}

export function getResourceTypeFromLabel(label: string): ResourceType {
  return getResourceType(slugifyResourceName(label))
}

export function resourceLabelClassName(resourceKey: string): string {
  switch (getResourceType(resourceKey)) {
    case 'gem':
      return 'text-amber-400'
    case 'harvest':
      return 'text-purple-400'
    case 'shop_special':
      return 'text-cyan-400'
    case 'salvage':
      return 'text-emerald-400'
    default:
      return 'text-red-400'
  }
}

export function resourceChipClassName(resourceKey: string): string {
  switch (getResourceType(resourceKey)) {
    case 'gem':
      return 'bg-amber-950/30 text-amber-400 border-amber-500/20'
    case 'harvest':
      return 'bg-purple-950/30 text-purple-400 border-purple-500/20'
    case 'shop_special':
      return 'bg-cyan-950/30 text-cyan-400 border-cyan-500/20'
    case 'salvage':
      return 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20'
    default:
      return 'bg-red-950/30 text-red-400 border-red-500/20'
  }
}

export function resourceQuantityUnitLabel(resourceKey: string): string {
  return isWholeUnitResource(resourceKey) ? 'units' : 'SCU'
}
