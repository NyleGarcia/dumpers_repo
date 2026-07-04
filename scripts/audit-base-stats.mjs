import gameBlueprints from '../src/data/game-blueprints.json' with { type: 'json' }

const props = new Map()
for (const b of gameBlueprints.blueprints) {
  const hasV = !!b.vehicleBaseStats
  const hasA = !!b.armorBaseStats
  const hasW = !!b.weaponBaseStats
  for (const slot of b.slots ?? []) {
    for (const opt of slot.options ?? []) {
      for (const m of opt.modifiers ?? []) {
        const p = (m.property ?? m.gameplayProperty ?? '').toLowerCase()
        if (!p) continue
        if (!props.has(p)) {
          props.set(p, { count: 0, hasV: 0, hasA: 0, hasW: 0, sample: b.internalName, category: b.category })
        }
        const e = props.get(p)
        e.count++
        if (hasV) e.hasV++
        if (hasA) e.hasA++
        if (hasW) e.hasW++
      }
    }
  }
}

console.log('=== Modifier properties ===')
for (const [p, e] of [...props.entries()].sort((a, b) => b.count - a.count)) {
  console.log(
    `${p}: ${e.count} slots | vehicleBase=${e.hasV} armorBase=${e.hasA} weaponBase=${e.hasW} | sample=${e.sample} (${e.category})`
  )
}

const withMods = gameBlueprints.blueprints.filter((b) =>
  (b.slots ?? []).some((s) => (s.options ?? []).some((o) => (o.modifiers ?? []).length))
)
const withAnyBase = withMods.filter((b) => b.vehicleBaseStats || b.armorBaseStats || b.weaponBaseStats)

console.log('\n=== Coverage ===')
console.log('Blueprints with modifiers:', withMods.length)
console.log('With any base stats:', withAnyBase.length)
console.log('Missing base stats:', withMods.length - withAnyBase.length)

const byCat = {}
for (const b of withMods) {
  const c = b.category ?? '?'
  byCat[c] ??= { total: 0, hasBase: 0, missing: [] }
  byCat[c].total++
  if (b.vehicleBaseStats || b.armorBaseStats || b.weaponBaseStats) {
    byCat[c].hasBase++
  } else if (byCat[c].missing.length < 3) {
    byCat[c].missing.push(b.internalName)
  }
}
console.log('\n=== By category ===')
console.log(JSON.stringify(byCat, null, 2))
