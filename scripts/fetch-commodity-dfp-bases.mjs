/**
 * Fetch UEX commodity base prices for Resource Tracker Q0 resources.
 *
 * Output: src/data/dfp-commodity-bases.json
 * Each entry: internalName, displayName, uexName, basePerScu, anchor, category
 *
 * Re-run monthly (or when UEX averages drift) — uexName is stored for future re-matching.
 * Consumed by dfp-engine-private/scripts/generate-commodity-bases.mjs during engine build.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getResourceTrackerQ0Catalog, resolveRepoRoot } from './lib/resourceTrackerCatalog.mjs'

const root = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)))
const outPath = path.join(root, 'src/data/dfp-commodity-bases.json')

const UEX_COMMODITIES_URL = 'https://api.uexcorp.space/2.0/commodities'

/** Salvage keys that keep UEX Buy + 10% premium (RMC / Construction Material). */
const SALVAGE_BUY_PREMIUM_KEYS = new Set(['rmc', 'construction_material'])

const DEFAULT_COMMODITY_BASE = 5000
const DEFAULT_SALVAGE_BASE = 9000

/** Manual base per SCU when UEX has no usable price. */
const MANUAL_BASE_OVERRIDES = {
  cave_kopion_horn: 34400,
  irradiated_kopion_horn: 34400,
  tundra_kopion_horn: 34400,
}

/** internalName -> UEX commodity name when displayName matching fails. */
const UEX_NAME_OVERRIDES = {
  rmc: 'Recycled Material Composite',
  construction_material: 'Construction Materials',
  e_tam: "E'tam",
  widow: 'WiDoW',
  xa_pyen: "Xa'Pyen",
  slam: 'SLAM',
  dcsr2: 'DCSR2',
  construction_material_pebbles: 'Construction Material Pebbles',
  construction_material_rubble: 'Construction Material Rubble',
  construction_material_salvage: 'Construction Material Salvage',
  ck13_gid_seed_blend: 'CK13-GID Seed Blend',
  zeta_prolanide: 'Zeta-Prolanide',
  acryliplex_composite: 'AcryliPlex Composite',
  hexapolymesh_coating: 'HexaPolyMesh Coating',
  carbon_silk: 'Carbon-Silk',
  audio_visual_equipment: 'Audio-Visual Equipment',
  lifecure_medsticks: 'LifeCure Medsticks',
  human_food_bars: 'Human Food Bars',
  revenant_tree_pollen: 'Revenant Tree Pollen',
  heart_of_the_woods: 'Heart of the Woods',
  cryopod: 'CryoPod',
  thermalfoam: 'Thermalfoam',
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function buildUexIndex(rows) {
  const byExact = new Map()
  const byNormalized = new Map()
  for (const row of rows) {
    if (!row.is_available || !row.is_visible) continue
    if (row.name?.includes('(Ore)')) continue
    byExact.set(row.name, row)
    const norm = normalizeName(row.name)
    if (!byNormalized.has(norm)) byNormalized.set(norm, row)
  }
  return { byExact, byNormalized }
}

function resolveUexRow(internalName, displayName, index) {
  const override = UEX_NAME_OVERRIDES[internalName]
  if (override && index.byExact.has(override)) {
    return { row: index.byExact.get(override), uexName: override }
  }
  if (index.byExact.has(displayName)) {
    return { row: index.byExact.get(displayName), uexName: displayName }
  }
  const norm = normalizeName(displayName)
  if (index.byNormalized.has(norm)) {
    const row = index.byNormalized.get(norm)
    return { row, uexName: row.name }
  }
  if (override) {
    const normOverride = normalizeName(override)
    if (index.byNormalized.has(normOverride)) {
      const row = index.byNormalized.get(normOverride)
      return { row, uexName: row.name }
    }
  }
  return null
}

function computeBasePerScu(internalName, row, category) {
  if (MANUAL_BASE_OVERRIDES[internalName]) {
    return { basePerScu: MANUAL_BASE_OVERRIDES[internalName], fallback: true }
  }

  const isSalvage = category === 'salvage'

  if (isSalvage) {
    let buy = row.price_buy ?? 0
    if (buy <= 0 && internalName.startsWith('construction_material')) {
      if (row.name.startsWith('Construction Material')) buy = 9628
    }
    if (buy <= 0) {
      return { basePerScu: DEFAULT_SALVAGE_BASE, fallback: true }
    }
    const premium = SALVAGE_BUY_PREMIUM_KEYS.has(internalName) ? 1.1 : 1
    return { basePerScu: Math.round(buy * premium), fallback: false }
  }

  const sell = row.price_sell ?? 0
  if (sell > 0) return { basePerScu: sell, fallback: false }
  const buy = row.price_buy ?? 0
  if (buy > 0) return { basePerScu: buy, fallback: true }
  return { basePerScu: DEFAULT_COMMODITY_BASE, fallback: true }
}

async function main() {
  const catalog = getResourceTrackerQ0Catalog(root)
  console.log(`Resource Tracker Q0 catalog: ${catalog.length} resources`)

  const res = await fetch(UEX_COMMODITIES_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'DumpersRepo-DFP-Fetch' },
  })
  if (!res.ok) throw new Error(`UEX fetch failed: ${res.status}`)
  const payload = await res.json()
  const uexRows = payload.data ?? payload
  const index = buildUexIndex(uexRows)

  const resources = {}
  const unmatched = []
  const priceFallbacks = []

  for (const { internalName, displayName, category } of catalog) {
    const manualBase = MANUAL_BASE_OVERRIDES[internalName]
    const resolved = manualBase ? null : resolveUexRow(internalName, displayName, index)

    if (!resolved && !manualBase) {
      unmatched.push({ internalName, displayName, reason: 'no UEX row' })
      continue
    }

    const pricing = manualBase
      ? { basePerScu: manualBase, fallback: true }
      : computeBasePerScu(internalName, resolved.row, category)

    if (pricing.fallback) {
      priceFallbacks.push({
        internalName,
        displayName,
        basePerScu: pricing.basePerScu,
        uexName: resolved?.uexName,
      })
    }

    resources[internalName] = {
      internalName,
      displayName,
      uexName: resolved?.uexName ?? UEX_NAME_OVERRIDES[internalName] ?? displayName,
      basePerScu: pricing.basePerScu,
      anchor: category === 'salvage' ? 'buy' : 'sell',
      category,
      ...(pricing.fallback ? { fallback: true } : {}),
    }
  }

  const output = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'UEX /2.0/commodities',
    catalogSource: 'Resource Tracker Q0 (extraResources.ts)',
    resources,
    priceFallbacks,
    unmatched,
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8')

  const salvageCount = Object.values(resources).filter((r) => r.category === 'salvage').length
  const commodityCount = Object.values(resources).filter((r) => r.category === 'commodity').length
  console.log(`Wrote ${Object.keys(resources).length} resources (${salvageCount} salvage, ${commodityCount} commodity)`)

  if (priceFallbacks.length > 0) {
    console.warn(`Price fallbacks: ${priceFallbacks.length} (manual/default base)`)
  }

  if (unmatched.length > 0) {
    console.error('\nUnmatched resources:')
    for (const u of unmatched) {
      console.error(`  - ${u.internalName} (${u.displayName}): ${u.reason}`)
    }
    process.exit(1)
  }

  console.log(`\nWrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
