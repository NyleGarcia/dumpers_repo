/**
 * Game lore extraction from localization (commodities + item descriptions).
 */

import {
  extractCommodityLore,
  normalizeDescriptionText,
} from './commodityLocalization.mjs'

const STEM_PREFIX_ALIASES = [
  ['anvil_', 'anvl_'],
  ['crusader_', 'crus_'],
  ['drak_', 'drak_'],
]

const PREFERRED_VARIANT_SUFFIXES = ['_01_01_01', '_01_01', '_01_01_01_01', '_1_a', '_01_a']

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

function applyStemAliases(stem) {
  let result = stem
  for (const [from, to] of STEM_PREFIX_ALIASES) {
    if (result.toLowerCase().startsWith(from)) {
      result = to + result.slice(from.length)
      break
    }
  }
  return result
}

function stemVariants(stem) {
  const variants = new Set([stem, applyStemAliases(stem)])
  for (const value of [...variants]) {
    variants.add(value.toLowerCase())
    variants.add(`${value},P`)
    variants.add(`${value},p`)
  }
  return [...variants]
}

const MANUFACTURER_CODES = {
  rsi: 'RSI',
  aegs: 'Aegis Dynamics',
  anvl: 'Anvil',
  drak: 'Drake',
  misc: 'MISC',
  crus: 'Crusader',
  orig: 'Origin',
}

function titleCaseWords(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function isPlaceholderDescription(description) {
  const trimmed = description.trim()
  return (
    /^\(PH\)/i.test(trimmed) ||
    /\(PH\).*(?:Description|Item Description)/i.test(trimmed)
  )
}

function labelFromShopStem(stem) {
  const match = stem.match(/^([A-Za-z]+)_(.+)_shop$/i)
  if (!match) return null

  const mfgCode = match[1].toLowerCase()
  const mfg = MANUFACTURER_CODES[mfgCode] || match[1].toUpperCase()
  const shipName = titleCaseWords(match[2].replace(/_/g, ' '))
  return `${mfg} ${shipName}`
}

/**
 * Parse a display label from description text when no item_Name key exists.
 * Returns null unless a heuristic match is confident.
 */
function tryHeuristicLabelFromDescription(description, stem) {
  if (!description || isPlaceholderDescription(description)) return null

  const trimmed = description.trim()
  const firstLine = trimmed.split(/\\n|\n/)[0].trim()

  const typeMatch = trimmed.match(/Item Type:\s*([^\n\\]+)/i)
  const mfgMatch = trimmed.match(/Manufacturer:\s*([^\n\\]+)/i)
  if (typeMatch && mfgMatch) {
    return `${mfgMatch[1].trim()} ${typeMatch[1].trim()}`
  }
  if (typeMatch) return typeMatch[1].trim()

  const shopLabel = labelFromShopStem(stem)
  if (shopLabel) return shopLabel

  const theMatch = trimmed.match(/^The (.+?) (?:from|by|offers|is|features|provides|has|was|will)/i)
  if (theMatch && theMatch[1].length <= 80) {
    return theMatch[1].trim()
  }

  const namedProductMatch = trimmed.match(/The (\w+) is a (?:sleek )?(\w+)/i)
  if (namedProductMatch) {
    return `${namedProductMatch[1]} ${titleCaseWords(namedProductMatch[2])}`
  }

  const productMatch = trimmed.match(/gives the (\w+) its/i)
  if (productMatch) {
    if (/\bshirt\b/i.test(trimmed)) return `${productMatch[1]} Shirt`
    if (/\bjumpsuit\b/i.test(trimmed)) return `${productMatch[1]} Jumpsuit`
    if (/\bjacket\b/i.test(trimmed)) return `${productMatch[1]} Jacket`
    return productMatch[1]
  }

  const paintMatch = trimmed.match(/^Modify your (.+?) with this (.+?) livery/i)
  if (paintMatch) {
    return `${paintMatch[1].trim()} ${titleCaseWords(paintMatch[2])} Livery`
  }

  const classicMatch = trimmed.match(/^A classic (.+?) commemorating (.+?)(?:\.|,)/i)
  if (classicMatch) {
    const event = classicMatch[2].split(/\s+/)[0]
    return `${titleCaseWords(event)} ${titleCaseWords(classicMatch[1])}`
  }

  const forYourMatch = trimmed.match(/^A (.+?) for your (.+?)\.?$/i)
  if (forYourMatch && forYourMatch[1].length <= 40) {
    return titleCaseWords(forYourMatch[1])
  }

  if (/orison theme/i.test(trimmed) && /cup|mug/i.test(stem)) {
    return 'Orison Mug'
  }

  if (/^A drinking vessel made from/i.test(trimmed)) {
    return 'Drinking Glass'
  }

  if (
    trimmed.length <= 80 &&
    trimmed === firstLine &&
    !/^Manufacturer:|^Carrying Capacity:|^Modify your|^Enjoy the|^Along with|^Built by|^Roberts Space|^Visor is/i.test(
      trimmed
    ) &&
    /^[A-Z][A-Za-z0-9 '&/-]+$/.test(trimmed) &&
    trimmed.split(/\s+/).length >= 2
  ) {
    return trimmed
  }

  const featuringMatch = trimmed.match(/^Featuring .+?, (?:this )?(.+?) (?:is|features|offers)/i)
  if (featuringMatch && featuringMatch[1].length <= 80) {
    return featuringMatch[1].trim()
  }

  return null
}

function pickPreferredVariant(candidates) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0].label

  for (const suffix of PREFERRED_VARIANT_SUFFIXES) {
    const match = candidates.find((candidate) => candidate.body.endsWith(suffix))
    if (match) return match.label
  }

  return [...candidates].sort((a, b) => a.body.length - b.body.length)[0].label
}

/**
 * Index all item_Name* localization keys for fast display-name lookup.
 */
export function buildItemNameIndex(localization) {
  const exact = new Map()
  const byPrefix = new Map()

  for (const [key, rawValue] of Object.entries(localization)) {
    if (key === '_lowerMap') continue

    const match = key.match(/^item_name_?(.+)$/i)
    if (!match) continue

    const label = normalizeDescriptionText(rawValue)
    if (!label || label.startsWith('@LOC')) continue

    const body = match[1]
    const bodyLower = body.toLowerCase()
    if (!exact.has(bodyLower)) exact.set(bodyLower, label)

    const parts = bodyLower.split('_')
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('_')
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
      byPrefix.get(prefix).push({ body: bodyLower, label })
    }
  }

  return { exact, byPrefix }
}

function findTokenMatch(stem, exact) {
  const tokens = stem
    .toLowerCase()
    .split('_')
    .filter((token) => token.length >= 3)

  if (tokens.length < 2) return null

  let best = null
  let bestScore = 0

  for (const [body, label] of exact.entries()) {
    const score = tokens.filter((token) => body.includes(token)).length
    if (score === tokens.length && score > bestScore) {
      best = label
      bestScore = score
    }
  }

  return best
}

function findComponentMatch(stem, exact) {
  const parts = stem.toLowerCase().split('_')
  const typeCode = parts[0]
  const tailToken = parts[parts.length - 1]
  if (!tailToken || tailToken.length < 3) return null

  const componentHints = {
    cool: ['cooler'],
    powr: ['powerplant', 'power'],
    shld: ['shield'],
    qdrv: ['quantum', 'drive'],
    radr: ['radar'],
    life: ['life', 'support'],
  }

  const hints = componentHints[typeCode]
  if (!hints) return null

  for (const [body, label] of exact.entries()) {
    if (!body.includes(tailToken)) continue
    if (hints.some((hint) => body.includes(hint))) return label
  }

  return null
}

export function resolveItemLabel(stem, nameIndex, description) {
  if (!stem) return humanizeStem(stem)

  for (const variant of stemVariants(stem)) {
    const exact = nameIndex.exact.get(variant.toLowerCase())
    if (exact) return exact
  }

  for (const variant of stemVariants(stem)) {
    const prefixMatches = nameIndex.byPrefix.get(variant.toLowerCase())
    if (prefixMatches?.length) {
      const preferred = pickPreferredVariant(prefixMatches)
      if (preferred) return preferred
    }
  }

  const trimmedStem = stem.replace(/_(?:shared|\d+[a-z]?)$/i, '')
  if (trimmedStem !== stem) {
    const trimmedLabel = resolveItemLabel(trimmedStem, nameIndex, null)
    if (trimmedLabel !== humanizeStem(trimmedStem)) return trimmedLabel
  }

  const componentMatch = findComponentMatch(stem, nameIndex.exact)
  if (componentMatch) return componentMatch

  const heuristicLabel = tryHeuristicLabelFromDescription(description, stem)
  if (heuristicLabel) return heuristicLabel

  const tokenMatch = findTokenMatch(stem, nameIndex.exact)
  if (tokenMatch) return tokenMatch

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
  const nameIndex = buildItemNameIndex(localization)

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
        label: resolveItemLabel(stem, nameIndex, description),
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
