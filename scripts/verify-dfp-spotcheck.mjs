import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/game-blueprints.json'), 'utf8'))
const engine = await import(pathToFileURL(path.join(root, 'public/dfp-engine.js')).href)

function band4Defaults(bp) {
  const qualities = {}
  for (let i = 0; i < (bp.slots ?? []).length; i++) {
    qualities[i] = 500
  }
  return qualities
}

function partsFromQualities(slotQualities) {
  return Object.entries(slotQualities).map(([idx, quality]) => ({
    slotIndex: Number(idx),
    quality,
  }))
}

function dfpWithParts(bp, slotQualities, craftQuantity = 1) {
  return engine.calculateBlueprintDfp(bp, {
    parts: partsFromQualities(slotQualities),
    craftQuantity,
  })
}

function dfpUniform(bp, quality, craftQuantity = 1) {
  const parts = (bp.slots ?? []).map((_, i) => ({ slotIndex: i, quality }))
  return engine.calculateBlueprintDfp(bp, { parts, craftQuantity })
}

const behrSmg = catalog.blueprints.find((b) => b.internalName === 'behr_smg_ballistic_01')
const igniter = catalog.blueprints.find((b) => b.internalName === 'lbco_sniper_energy_01_sunset01')

if (behrSmg) {
  const defaults = band4Defaults(behrSmg)
  const cardDfp = dfpWithParts(behrSmg, defaults)
  const uniform700 = dfpUniform(behrSmg, 700)
  console.log(`P8-SC SMG Band4-default total: ${cardDfp.total.toLocaleString()}`)
  console.log(`P8-SC SMG uniform Q700 total: ${uniform700.total.toLocaleString()}`)
}

if (igniter) {
  const mixed = { ...band4Defaults(igniter) }
  const gemSlotIdx = igniter.slots.findIndex((s) =>
    s.options?.some((o) => o.displayName === 'Dolivine' || o.entityName === 'Dolivine')
  )
  if (gemSlotIdx >= 0) mixed[gemSlotIdx] = 1000
  const mixedTotal = dfpWithParts(igniter, mixed)
  const minFloor = dfpUniform(igniter, Math.min(...Object.values(mixed)))
  console.log(`Igniter mixed Q1000 gem + Band4 ores: ${mixedTotal.total.toLocaleString()}`)
  console.log(`Igniter old min-floor would be: ${minFloor.total.toLocaleString()}`)
  console.log(`Mixed > min-floor: ${mixedTotal.total > minFloor.total}`)
}

const ammoMag = catalog.blueprints.find((b) => b.internalName === 'behr_shotgun_ballistic_01_mag')
if (ammoMag) {
  const ammo = engine.calculateBlueprintDfp(ammoMag)
  console.log(`BR-2 mag (ammo, quality-agnostic): ${ammo.total.toLocaleString()}`)
}

const targets = ['behr_shotgun_ballistic_01', 'lbco_sniper_energy_01_sunset01', 'carryable_2h_cy_collectormaterial_001']

for (const id of targets) {
  const bp = catalog.blueprints.find((b) => b.internalName === id)
  if (!bp) {
    console.log(`${id}: NOT FOUND`)
    continue
  }
  const result = dfpWithParts(bp, band4Defaults(bp))
  console.log(`${id} (${bp.blueprintName}) Band4-default total: ${result.total.toLocaleString()}`)
}
