/**
 * Commodity localization helpers for parse-extracted-data.mjs.
 * Mirrors app slug rules in src/lib/blueprintResources.ts.
 */

/** Explicit localization stem -> app resourceKey overrides. */
export const COMMODITY_KEY_ALIASES = {
  distilledspirits: 'distilled_spirits',
  freshfood: 'fresh_food',
  processedfood: 'processed_food',
  humanfoodbars: 'human_food_bars',
  medicalsupplies: 'medical_supplies',
  osionhides: 'osoian_hides',
  type_rmc: 'rmc',
  type_agriculturalsupply: 'agricultural_supplies',
  crudeoil: 'crude_oil',
  sunsetberry: 'sunset_berries',
  marokgem: 'marok_gem',
  degnousroot: 'degnous_root',
  decaripod: 'decari_pod',
  carbon_silk: 'carbon_silk',
  revenanttreepollen: 'revenant_tree_pollen',
  ck13gidseedblend: 'ck13_gid_seed_blend',
  rantadung: 'ranta_dung',
  zetaprolanide: 'zeta_prolanide',
  acryliplexcomposite: 'acryliplex_composite',
  diamondlaminate: 'diamond_laminate',
  hexapolymeshcoating: 'hexapolymesh_coating',
  audiovisualequipment: 'audio_visual_equipment',
  redfinenergymodulators: 'redfin_energy_modulators',
  lifecuremedsticks: 'lifecure_medsticks',
  gaspingweevileggs: 'gasping_weevil_eggs',
  heartofthewoods: 'heart_of_the_woods',
  goldenmedmon: 'golden_medmon',
  revenantpod: 'revenant_pod',
  constructionmaterial: 'construction_material',
  constructionmaterialpebbles: 'construction_material_pebbles',
  constructionmaterialrubble: 'construction_material_rubble',
  constructionmaterialsalvage: 'construction_material_salvage',
  inertmaterials: 'inert_materials',
  hydrogenfuel: 'hydrogen_fuel',
  quantumfuel: 'quantum_fuel',
  type_plasmafuel: 'hydrogen_fuel',
  type_quantumfuel: 'quantum_fuel',
  ck13gidseeds: 'ck13_gid_seed_blend',
  constructionmaterials: 'construction_material',
  antihydrogen: 'anti_hydrogen',
  etam: 'e_tam',
}

export function slugifyResourceKey(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function normalizeDescriptionText(value) {
  if (!value || typeof value !== 'string') return ''
  return value
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse items_commodities description keys.
 * Returns { stem, isRaw, locKey } or null.
 */
export function parseCommodityLocKey(key) {
  if (!key || typeof key !== 'string') return null

  const rawMatch = key.match(/^items_commodities_(.+?)_raw_(?:desc|des)$/i)
  if (rawMatch) {
    return { stem: rawMatch[1], isRaw: true, locKey: key }
  }

  const match = key.match(/^items_commodities_(.+?)_(?:desc|des)$/i)
  if (!match) return null

  return { stem: match[1], isRaw: false, locKey: key }
}

export function locStemToResourceKey(stem) {
  if (!stem) return ''

  const slug = slugifyResourceKey(stem)
  const aliasKey = slug.replace(/_/g, '')
  if (COMMODITY_KEY_ALIASES[aliasKey]) {
    return COMMODITY_KEY_ALIASES[aliasKey]
  }
  if (COMMODITY_KEY_ALIASES[slug]) {
    return COMMODITY_KEY_ALIASES[slug]
  }

  return slug
}

function lookupLocalization(localization, key) {
  if (!key) return null
  if (localization[key]) return localization[key]
  if (localization._lowerMap?.[key.toLowerCase()]) {
    return localization._lowerMap[key.toLowerCase()]
  }
  return null
}

export function resolveCommodityLabel(stem, localization) {
  const keysToTry = [
    `items_commodities_${stem}`,
    `items_commodities_${stem},P`,
  ]

  for (const key of keysToTry) {
    const value = lookupLocalization(localization, key)
    if (value && value !== '@LOC_PLACEHOLDER' && value !== '@LOC_UNINITIALIZED') {
      return value
    }
  }

  return stem
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Extract commodity lore from localization map.
 */
export function extractCommodityLore(localization) {
  const lore = {}
  const rawCandidates = new Map()

  for (const [key, rawValue] of Object.entries(localization)) {
    if (key === '_lowerMap') continue

    const parsed = parseCommodityLocKey(key)
    if (!parsed) continue

    const description = normalizeDescriptionText(rawValue)
    if (!description || description.length <= 20) continue
    if (description === '@LOC_PLACEHOLDER' || description === '@LOC_UNINITIALIZED') continue

    const resourceKey = locStemToResourceKey(parsed.stem)
    if (!resourceKey) continue

    const entry = {
      key: parsed.locKey,
      label: resolveCommodityLabel(parsed.stem, localization),
      description,
      isRaw: parsed.isRaw,
    }

    if (parsed.isRaw) {
      if (!rawCandidates.has(resourceKey)) rawCandidates.set(resourceKey, [])
      rawCandidates.get(resourceKey).push(entry)
      continue
    }

    lore[resourceKey] = entry
  }

  for (const [resourceKey, candidates] of rawCandidates.entries()) {
    if (lore[resourceKey]) continue
    const best = candidates[0]
    if (best) {
      lore[resourceKey] = {
        key: best.key,
        label: best.label,
        description: best.description,
      }
    }
  }

  for (const entry of Object.values(lore)) {
    delete entry.isRaw
  }

  return lore
}
