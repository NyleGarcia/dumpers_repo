import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/game-blueprints.json'), 'utf8'))
const engine = await import(pathToFileURL(path.join(root, 'public/dfp-engine.js')).href)

const targets = [
  'behr_shotgun_ballistic_01',
  'lbco_sniper_energy_01_sunset01',
  'carryable_2h_cy_collectormaterial_001',
  'behr_smg_ballistic_01',
]

for (const id of targets) {
  const bp = catalog.blueprints.find((b) => b.internalName === id)
  if (!bp) {
    console.log(`${id}: NOT FOUND`)
    continue
  }
  const result = engine.calculateBlueprintDfp(bp)
  console.log(`${id} (${bp.blueprintName})`)
  console.log(`  material: ${result.materialTotal.toLocaleString()}`)
  console.log(`  acquisition: ${result.acquisitionPremium.toLocaleString()}`)
  console.log(`  labor: ${result.craftLaborPremium.toLocaleString()}`)
  console.log(`  total: ${result.total.toLocaleString()}`)
  console.log('')
}
