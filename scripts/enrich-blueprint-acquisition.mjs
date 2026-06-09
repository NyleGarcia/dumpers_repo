/**
 * Enrich sccrafter Blueprints.json with Star Citizen Wiki acquisition data:
 * faction rep ladders, per-mission min_standing + reputation_amount, blueprint unlock tiers.
 *
 * API: https://api.star-citizen.wiki (60 req/min — rate-limited below)
 * Credit: api.star-citizen.wiki
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const API_BASE = 'https://api.star-citizen.wiki/api'
const RATE_MS = 1100
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const blueprintsPath = join(root, 'src', 'data', 'Blueprints.json')
const outputPath = join(root, 'src', 'data', 'blueprint-acquisition.json')
const cacheDir = join(root, 'scripts', '.cache', 'sc-wiki')

let lastRequestAt = 0

async function apiFetch(path) {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < RATE_MS) {
    await new Promise((r) => setTimeout(r, RATE_MS - elapsed))
  }
  lastRequestAt = Date.now()

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`SC Wiki API ${response.status}: ${url}`)
  }
  return response.json()
}

async function paginateAll(resource, query = '') {
  const items = []
  let page = 1
  let lastPage = 1

  while (page <= lastPage) {
    const sep = query ? (query.includes('?') ? '&' : '?') : '?'
    const json = await apiFetch(`/${resource}${query}${sep}page[number]=${page}&page[size]=50`)
    const batch = json.data ?? []
    items.push(...batch)
    lastPage = json.meta?.last_page ?? 1
    process.stdout.write(`\r  ${resource}: page ${page}/${lastPage} (${items.length} rows)`)
    page++
  }
  process.stdout.write('\n')
  return items
}

function slugifyGiver(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseSccrafterMission(label) {
  const colon = label.indexOf(':')
  if (colon <= 0) return { giverSlug: '', title: label.trim() }
  return {
    giverSlug: slugifyGiver(label.slice(0, colon).trim()),
    title: label.slice(colon + 1).trim(),
  }
}

function normalizeMissionTitle(title) {
  let t = title
    .replace(/~mission\s*\(\s*Location[^)]*\)/gi, '[location]')
    .replace(/~mission\s*\(\s*TargetName[^)]*\)/gi, '[target]')
    .replace(/~mission\s*\(\s*Danger[^)]*\)/gi, '[danger]')
    .replace(/~mission\s*\([^)]*\)/gi, '[param]')
    .replace(/\[Location[^\]]*\]/gi, '[location]')
    .replace(/\[NearbyLocation[^\]]*\]/gi, '[location]')
    .replace(/\[TargetName[^\]]*\]/gi, '[target]')
    .replace(/\[Danger[^\]]*\]/gi, '[danger]')
    .replace(/\bat\s+[a-z0-9][\w\s'-]{1,40}?\s+(offline|online)\b/gi, 'at [location] $1')
    .replace(/\brally at\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'rally at [location]')
    .replace(/\bwipe\s+[a-z0-9][\w\s'-]{1,40}\s+out\b/gi, 'wipe [location] out')
    .replace(/\bat\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'at [location]')
    .replace(/\bnear\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'near [location]')
    .replace(/\bverified bounty:\s*.+$/gi, 'verified bounty: [target]')
    .replace(/\bbounty assignment:\s*.+$/gi, 'bounty assignment: [target]')
    .replace(/\bwanted:\s*.+$/gi, 'wanted: [target]')
    .replace(/\bgreen light on\s+.+/gi, 'green light on [target]')
    .replace(/\bdeal with\s+[\w\s]+?\s+at\b/gi, 'deal with [enemy] at')
    .replace(/\bkill\s+[\w\s]+?\s+at\b/gi, 'kill [enemy] at')
    .replace(/\bbutcher\s+[\w\s]+?\s+at\b/gi, 'butcher [enemy] at')
    .replace(/\bhit\s+[\w\s]+?\s+at\b/gi, 'hit [enemy] at')
    .replace(/uninitialized/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  return t
}

function missionLookupKey(giverSlug, title) {
  return `${giverSlug}|${normalizeMissionTitle(title)}`
}

function missionTypeKey(giverSlug, title) {
  const norm = normalizeMissionTitle(title)
    .replace(/\[location\]/g, '_loc_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `${giverSlug}_${norm}`
}

function labelLookupKey(label) {
  const { giverSlug, title } = parseSccrafterMission(label)
  return missionLookupKey(giverSlug, title)
}

function recordNameToWikiKey(recordName) {
  if (!recordName) return null
  const raw = recordName.replace(/^CraftingBlueprintRecord\./, '')
  return raw.startsWith('BP_') ? raw : null
}

function aggregateRange(values) {
  const nums = values.filter((v) => typeof v === 'number' && !Number.isNaN(v))
  if (nums.length === 0) return { min: null, max: null }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

async function main() {
  if (!existsSync(blueprintsPath)) {
    throw new Error(`Missing ${blueprintsPath} — run npm run fetch-blueprints first`)
  }

  const catalog = JSON.parse(readFileSync(blueprintsPath, 'utf8'))
  const rewardBps = catalog.blueprints.filter((bp) => bp.isReward)

  console.log(`Enriching ${rewardBps.length} reward blueprints (catalog ${catalog.version})`)

  mkdirSync(cacheDir, { recursive: true })

  console.log('Fetching factions...')
  const factionsRaw = await paginateAll('factions')
  const factions = {}

  for (const faction of factionsRaw) {
    const slug = slugifyGiver(faction.name)

    let standings = []
    try {
      const detail = await apiFetch(`/factions/${faction.uuid}?include=reputationLadder`)
      const ladder = detail.data?.reputation_ladder?.standings ?? []
      standings = ladder
        .map((s) => ({
          displayName: s.display_name ?? s.name,
          minReputation: s.min_reputation ?? 0,
        }))
        .sort((a, b) => a.minReputation - b.minReputation)
    } catch {
      standings = []
    }

    factions[slug] = {
      wikiName: faction.name,
      uuid: faction.uuid,
      standings,
    }
  }

  console.log('Fetching missions with blueprint rewards...')
  const missionsRaw = await paginateAll('missions', '?filter[has_blueprints]=true')

  const missionIndex = new Map()
  const missionTypeGroups = new Map()

  for (const m of missionsRaw) {
    const giverSlug = slugifyGiver(m.mission_giver ?? '')
    const title = m.title ?? ''
    const lookupKey = missionLookupKey(giverSlug, title)
    const typeKey = missionTypeKey(giverSlug, title)

    const entry = {
      uuid: m.uuid,
      wikiTitle: title,
      missionGiver: m.mission_giver,
      giverSlug,
      minStandingName: m.min_standing_name ?? m.min_standing?.name ?? null,
      minReputation: m.min_standing?.min_reputation ?? null,
      reputationAmount: m.reputation_amount ?? null,
      rankIndex: m.rank_index ?? null,
      missionTypeKey: typeKey,
    }

    if (!missionIndex.has(lookupKey)) missionIndex.set(lookupKey, [])
    missionIndex.get(lookupKey).push(entry)

    if (!missionTypeGroups.has(typeKey)) {
      missionTypeGroups.set(typeKey, {
        missionTypeKey: typeKey,
        giverSlug,
        missionGiver: m.mission_giver,
        displayTitle: normalizeMissionTitle(title).replace(/\[location\]/g, '[Location]'),
        variants: [],
      })
    }
    missionTypeGroups.get(typeKey).variants.push(entry)
  }

  console.log('Fetching wiki blueprint index...')
  const wikiBps = await paginateAll('blueprints')
  const wikiByKey = new Map()
  const wikiByOutputName = new Map()

  for (const bp of wikiBps) {
    if (bp.key) wikiByKey.set(bp.key, bp)
    const nameKey = (bp.output_name ?? '').trim().toLowerCase()
    if (nameKey) {
      if (!wikiByOutputName.has(nameKey)) wikiByOutputName.set(nameKey, [])
      wikiByOutputName.get(nameKey).push(bp)
    }
  }

  const missionTypes = {}
  for (const [typeKey, group] of missionTypeGroups) {
    const rep = aggregateRange(group.variants.map((v) => v.reputationAmount))
    const minRep = aggregateRange(group.variants.map((v) => v.minReputation))
    missionTypes[typeKey] = {
      missionTypeKey: typeKey,
      giverSlug: group.giverSlug,
      missionGiver: group.missionGiver,
      displayTitle: group.displayTitle,
      reputationMin: rep.min,
      reputationMax: rep.max,
      minReputationMin: minRep.min,
      minReputationMax: minRep.max,
      variantCount: group.variants.length,
    }
  }

  const missionsByLabel = {}
  const blueprintsOut = {}

  let matchedBps = 0
  let unmatchedBps = 0
  let matchedMissionLabels = 0
  let unmatchedMissionLabels = 0

  for (const bp of rewardBps) {
    const wikiKey = recordNameToWikiKey(bp.recordName)
    const wikiBp = wikiKey ? wikiByKey.get(wikiKey) : null
    const wikiByName =
      !wikiBp && bp.blueprintName
        ? (wikiByOutputName.get(bp.blueprintName.trim().toLowerCase()) ?? [])[0]
        : null
    const resolvedWiki = wikiBp ?? wikiByName

    const missionMatches = []
    const unmatchedMissions = []

    for (const reward of bp.rewardMissions ?? []) {
      const label = reward.mission?.trim()
      if (!label) continue
      if (/uninitialized/i.test(label)) continue

      const lookupKey = labelLookupKey(label)
      const variants = missionIndex.get(lookupKey) ?? []

      if (variants.length === 0) {
        unmatchedMissions.push(label)
        unmatchedMissionLabels++
        continue
      }

      matchedMissionLabels++

      const rep = aggregateRange(variants.map((v) => v.reputationAmount))
      const minRep = aggregateRange(variants.map((v) => v.minReputation))
      const typeKey = variants[0].missionTypeKey
      const lowestVariant = variants.reduce((best, v) => {
        const repVal = v.minReputation ?? Infinity
        const bestVal = best.minReputation ?? Infinity
        return repVal < bestVal ? v : best
      }, variants[0])

      missionsByLabel[lookupKey] = {
        sccrafterLabel: label,
        lookupKey,
        missionTypeKey: typeKey,
        repMin: rep.min,
        repMax: rep.max,
        minReputation: minRep.min,
        minStandingName: lowestVariant.minStandingName,
        variantCount: variants.length,
        missionGiver: variants[0].missionGiver,
        giverSlug: variants[0].giverSlug,
      }

      missionMatches.push({
        label,
        lookupKey,
        dropChance: reward.chance ?? 1,
        repMin: rep.min,
        repMax: rep.max,
        minReputation: minRep.min,
        minStandingName: lowestVariant.minStandingName,
      })
    }

    let unlockMinReputation = null
    let unlockStandingName = null

    if (missionMatches.length > 0) {
      const easiest = missionMatches.reduce((best, m) => {
        const rep = m.minReputation ?? Infinity
        const bestRep = best.minReputation ?? Infinity
        return rep < bestRep ? m : best
      }, missionMatches[0])
      unlockMinReputation = easiest.minReputation
      unlockStandingName = easiest.minStandingName
    }

    const bpMatched = !!resolvedWiki || missionMatches.length > 0
    if (bpMatched) matchedBps++
    else unmatchedBps++

    blueprintsOut[bp.file] = {
      blueprintName: bp.blueprintName,
      wikiKey: resolvedWiki?.key ?? wikiKey ?? null,
      wikiUuid: resolvedWiki?.uuid ?? null,
      isAvailableByDefault: resolvedWiki?.is_available_by_default ?? false,
      unlockMinReputation,
      unlockStandingName,
      unlockingMissionsCount: resolvedWiki?.unlocking_missions_count ?? null,
      matchedMissionCount: missionMatches.length,
      unmatchedMissionCount: unmatchedMissions.length,
      unmatchedMissions: unmatchedMissions.length > 0 ? unmatchedMissions : undefined,
      missionMatches: missionMatches.length > 0 ? missionMatches : undefined,
    }
  }

  const gameVersion = wikiBps[0]?.game_version ?? catalog.version

  const output = {
    version: catalog.version,
    gameVersion,
    generatedAt: new Date().toISOString(),
    source: 'api.star-citizen.wiki',
    stats: {
      rewardBlueprints: rewardBps.length,
      matchedRewardBlueprints: matchedBps,
      unmatchedRewardBlueprints: unmatchedBps,
      matchRatePercent: Math.round((matchedBps / rewardBps.length) * 1000) / 10,
      matchedMissionLabels,
      unmatchedMissionLabels,
      wikiMissionsIndexed: missionsRaw.length,
      missionTypes: Object.keys(missionTypes).length,
    },
    factions,
    missionTypes,
    missionsByLabel,
    blueprints: blueprintsOut,
  }

  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log('\nblueprint-acquisition.json written')
  console.log(`  path:       ${outputPath}`)
  console.log(`  BP match:   ${matchedBps}/${rewardBps.length} (${output.stats.matchRatePercent}%)`)
  console.log(`  missions:   ${matchedMissionLabels} matched, ${unmatchedMissionLabels} unmatched labels`)
  console.log(`  types:      ${Object.keys(missionTypes).length} mission type groups`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
