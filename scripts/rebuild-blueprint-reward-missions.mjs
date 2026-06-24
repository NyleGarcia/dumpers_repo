#!/usr/bin/env node
/**
 * Rebuild rewardMissions on game-blueprints.json from contract-accurate mappings
 * in game-blueprint-missions.json (no full re-extract required).
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const missionData = JSON.parse(readFileSync(join(root, 'src/data/game-blueprint-missions.json'), 'utf-8'))
const blueprintData = JSON.parse(readFileSync(join(root, 'src/data/game-blueprints.json'), 'utf-8'))

const missionBlueprints = missionData.missionBlueprints
const contracts = missionData.contracts

function buildBlueprintRewardMissionsFromContracts(internalName) {
  const bpName = (internalName || '').toLowerCase()
  if (!bpName) return []

  const raw = []

  for (const contract of contracts) {
    for (const poolRef of contract.blueprintPools || []) {
      const poolItems = missionBlueprints[poolRef.key]
      if (!poolItems?.length) continue

      const item = poolItems.find((entry) => (entry.name || '').toLowerCase() === bpName)
      if (!item) continue

      const totalWeight = poolItems.reduce((sum, entry) => sum + (entry.weight || 1), 0)
      const poolChance = poolRef.chance ?? 1
      const dropChance = totalWeight > 0 ? poolChance * ((item.weight || 1) / totalWeight) : 0

      raw.push({
        mission: contract.faction && contract.title ? `${contract.faction}: ${contract.title}` : contract.title,
        chance: dropChance,
        poolChance,
        poolKey: poolRef.key,
        locations: contract.system ? [contract.system] : [],
        system: contract.system || null,
        region: contract.region || null,
        category: contract.category || null,
        repPoints: contract.repPoints || 0,
        minReputation: contract.minStanding?.minReputation ?? null,
        maxReputation: contract.maxStanding?.minReputation ?? null,
        standingName: contract.minStanding?.name ?? null,
        maxStandingName: contract.maxStanding?.name ?? null,
      })
    }
  }

  const grouped = new Map()
  for (const reward of raw) {
    const key = `${reward.mission}|${reward.minReputation ?? 'null'}|${reward.maxReputation ?? 'null'}`
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...reward, locations: [...reward.locations] })
      continue
    }
    for (const loc of reward.locations) {
      if (!existing.locations.includes(loc)) existing.locations.push(loc)
    }
    if (reward.chance > existing.chance) existing.chance = reward.chance
  }

  return [...grouped.values()].sort((a, b) => {
    const repDiff = (a.minReputation ?? 0) - (b.minReputation ?? 0)
    if (repDiff !== 0) return repDiff
    return a.mission.localeCompare(b.mission)
  })
}

let updated = 0
for (const bp of blueprintData.blueprints) {
  const rewardMissions = buildBlueprintRewardMissionsFromContracts(bp.internalName || bp.name)
  const hadReward = bp.isReward
  const nextReward = rewardMissions.length > 0

  if (JSON.stringify(bp.rewardMissions) !== JSON.stringify(rewardMissions) || hadReward !== nextReward) {
    updated++
  }

  bp.rewardMissions = rewardMissions
  bp.isReward = nextReward
}

blueprintData.summary = {
  ...blueprintData.summary,
  blueprintsWithRewards: blueprintData.blueprints.filter((bp) => bp.isReward).length,
  rewardMissionsRebuilt: new Date().toISOString(),
}

writeFileSync(join(root, 'src/data/game-blueprints.json'), JSON.stringify(blueprintData, null, 2) + '\n')
console.log(`Rebuilt rewardMissions for ${updated} blueprints`)
