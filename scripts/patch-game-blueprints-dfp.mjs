/**
 * One-time patch: align game-blueprints.json with parsed-catalog DFP shape.
 * Run before rebuilding dfp-engine when full parse is not re-run.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(root, 'src', 'data', 'game-blueprints.json')

const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
let filePatched = 0
let entityPatched = 0
let quantityRemoved = 0

for (const bp of data.blueprints ?? []) {
  if (bp.internalName && bp.file !== bp.internalName) {
    bp.file = bp.internalName
    filePatched++
  }
  for (const slot of bp.slots ?? []) {
    for (const opt of slot.options ?? []) {
      if (opt.type === 'item' && opt.displayName && !opt.entityName) {
        opt.entityName = opt.displayName
        entityPatched++
      }
      if (
        opt.type === 'resource' &&
        opt.standardCargoUnits != null &&
        opt.quantity != null &&
        opt.quantity === opt.standardCargoUnits
      ) {
        delete opt.quantity
        quantityRemoved++
      }
    }
  }
}

fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2) + '\n')
console.log(`Patched ${catalogPath}`)
console.log(`  file -> internalName: ${filePatched}`)
console.log(`  entityName from displayName: ${entityPatched}`)
console.log(`  duplicate quantity removed: ${quantityRemoved}`)
