/**
 * Game lore extraction from localization (commodities + item descriptions).
 */

import {
  extractCommodityLore,
  normalizeDescriptionText,
} from './commodityLocalization.mjs'

function lookupLocalization(localization, key) {
  if (!key) return null
  if (localization[key]) return localization[key]
  if (localization._lowerMap?.[key.toLowerCase()]) {
    return localization._lowerMap[key.toLowerCase()]
  }
  return null
}

function humanizeStem(stem) {
  return stem
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function resolveItemLabel(stem, localization) {
  const keysToTry = [
    `item_Name${stem}`,
    `item_name${stem}`,
    `Item_Name${stem}`,
    `Item_name${stem}`,
  ]

  for (const key of keysToTry) {
    const value = lookupLocalization(localization, key)
    if (value && value !== '@LOC_PLACEHOLDER' && value !== '@LOC_UNINITIALIZED') {
      return value
    }
  }

  return humanizeStem(stem)
}

function isMeaningfulDescription(description) {
  if (!description || description.length <= 20) return false
  if (description === '@LOC_PLACEHOLDER' || description === '@LOC_UNINITIALIZED') return false
  return true
}

const ITEM_DESC_PATTERNS = [
  /^item_desc_(\w+)$/i,
  /^item_desc(\w+)$/i,
]

/**
 * Extract item_desc lore (armor, weapons, ship components, flair, etc.).
 */
export function extractItemLore(localization) {
  const lore = {}

  for (const [key, rawValue] of Object.entries(localization)) {
    if (key === '_lowerMap') continue

    const description = normalizeDescriptionText(rawValue)
    if (!isMeaningfulDescription(description)) continue

    for (const pattern of ITEM_DESC_PATTERNS) {
      const match = key.match(pattern)
      if (!match) continue

      const stem = match[1]
      const resourceKey = stem.toLowerCase()

      lore[resourceKey] = {
        key,
        label: resolveItemLabel(stem, localization),
        description,
        kind: 'item',
      }
      break
    }
  }

  return lore
}

/**
 * Extract all game lore: commodities first, then item descriptions.
 */
export function extractAllGameLore(localization) {
  const lore = {}

  for (const [resourceKey, entry] of Object.entries(extractCommodityLore(localization))) {
    lore[resourceKey] = {
      ...entry,
      kind: 'commodity',
    }
  }

  const itemLore = extractItemLore(localization)
  for (const [resourceKey, entry] of Object.entries(itemLore)) {
    if (!lore[resourceKey]) {
      lore[resourceKey] = entry
    }
  }

  // Legacy commodity_* description keys not covered by items_commodities parsing
  for (const [key, rawValue] of Object.entries(localization)) {
    if (key === '_lowerMap') continue

    const match = key.match(/^commodity_(\w+)_(?:desc|des)$/i)
    if (!match) continue

    const resourceKey = match[1].toLowerCase()
    if (lore[resourceKey]) continue

    const description = normalizeDescriptionText(rawValue)
    if (!isMeaningfulDescription(description)) continue

    lore[resourceKey] = {
      key,
      label: humanizeStem(match[1]),
      description,
      kind: 'commodity',
    }
  }

  return lore
}
