/**
 * Exhaustive audit: for each *_01_01_01 blueprint, try all canonical key strategies.
 */
import fs from 'fs'

const locPath = 'extracted-data/Data/Localization/english/global.ini'
const bpPath = 'src/data/game-blueprints.json'

const localization = {}
for (const line of fs.readFileSync(locPath, 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=')
  if (eq === -1) continue
  localization[line.slice(0, eq)] = line.slice(eq + 1)
}

function canonicalKeysForInternal(internalName) {
  const keys = []
  const n = internalName.toLowerCase()

  let m = n.match(/^(\w+)_legacy_armor_(\w+)_(\w+)_01_01_01$/)
  if (m) keys.push(`item_Name_${m[1]}_legacy_${m[2]}_armor_01_${m[3]}`)

  m = n.match(/^(\w+)_explorer_armor_(\w+)_(\w+)_01_01_01$/)
  if (m) {
    keys.push(`item_Name_${m[1]}_explorer_01_${m[3]}`)
    keys.push(`item_Name_${m[1]}_explorer_${m[2]}_armor_01_${m[3]}`)
  }

  m = n.match(/^(\w+)_armor_(\w+)_(\w+)_01_01_01$/)
  if (m) keys.push(`item_Name_${m[1]}_${m[2]}_armor_01_${m[3]}`)

  return keys
}

const data = JSON.parse(fs.readFileSync(bpPath, 'utf8'))
const mismatches = []

for (const bp of data.blueprints) {
  if (!/_01_01_01$/i.test(bp.internalName || '')) continue
  const keys = canonicalKeysForInternal(bp.internalName)
  for (const key of keys) {
    const canon = localization[key]
    if (!canon) continue
    if (bp.blueprintName !== canon) {
      mismatches.push({
        internalName: bp.internalName,
        current: bp.blueprintName,
        canonical: canon,
        key,
      })
    }
    break // first matching canonical key wins (same order as parser will use)
  }
}

console.log(`Base variant mismatches: ${mismatches.length}`)
for (const x of mismatches.sort((a, b) => a.internalName.localeCompare(b.internalName))) {
  console.log(`${x.internalName}: "${x.current}" -> "${x.canonical}" (${x.key})`)
}
