/**
 * Enrich mission rep data by cross-referencing scunpacked-data contracts.
 * 
 * This script downloads contract data from the StarCitizenWiki/scunpacked-data repo
 * and matches it against our unmatched missions to fill in rep requirements.
 * 
 * Run: node scripts/enrich-missions-scunpacked.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, 'scripts', '.cache', 'scunpacked')
const acquisitionPath = join(root, 'src', 'data', 'blueprint-acquisition.json')

const GITHUB_API = 'https://api.github.com/repos/StarCitizenWiki/scunpacked-data/contents'
const RATE_MS = 100  // Be nice to GitHub

let lastRequestAt = 0

async function fetchJson(url) {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < RATE_MS) {
    await new Promise(r => setTimeout(r, RATE_MS - elapsed))
  }
  lastRequestAt = Date.now()
  
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'DumpersRepo/1.0'
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json()
}

async function fetchWithCache(url, cacheFile, maxAgeHours = 24) {
  const cachePath = join(cacheDir, cacheFile)
  
  if (existsSync(cachePath)) {
    const stat = await import('fs').then(fs => fs.statSync(cachePath))
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)
    if (ageHours < maxAgeHours) {
      return JSON.parse(readFileSync(cachePath, 'utf8'))
    }
  }
  
  const data = await fetchJson(url)
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, JSON.stringify(data, null, 2))
  return data
}

function slugifyGiver(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeMissionTitle(title) {
  return title
    .replace(/~mission\s*\(\s*Location[^)]*\)/gi, '[location]')
    .replace(/~mission\s*\(\s*TargetName[^)]*\)/gi, '[target]')
    .replace(/~mission\s*\(\s*Danger[^)]*\)/gi, '[danger]')
    .replace(/~mission\s*\(\s*StoreName[^)]*\)/gi, '[store]')
    .replace(/~mission\s*\([^)]*\)/gi, '[param]')
    .replace(/\[Location[^\]]*\]/gi, '[location]')
    .replace(/\[NearbyLocation[^\]]*\]/gi, '[location]')
    .replace(/\[TargetName[^\]]*\]/gi, '[target]')
    .replace(/\[Danger[^\]]*\]/gi, '[danger]')
    .replace(/\[StoreName[^\]]*\]/gi, '[store]')
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
}

function missionLookupKey(giverSlug, title) {
  return `${giverSlug}|${normalizeMissionTitle(title)}`
}

async function main() {
  console.log('Enriching mission data from scunpacked-data...\n')
  mkdirSync(cacheDir, { recursive: true })
  
  // Load current acquisition data
  const acquisition = JSON.parse(readFileSync(acquisitionPath, 'utf8'))
  
  // Get list of all contract files
  console.log('Fetching contract file list...')
  const contractsDir = await fetchWithCache(`${GITHUB_API}/contracts`, 'contracts-dir.json', 168) // 1 week cache
  const contractFiles = contractsDir.filter(f => f.name.endsWith('.json'))
  console.log(`Found ${contractFiles.length} contract files\n`)
  
  // Build index of scunpacked contracts
  console.log('Building contract index (this may take a few minutes on first run)...')
  const contractIndex = new Map() // key -> array of contracts
  const allContracts = []
  
  let processed = 0
  for (const file of contractFiles) {
    try {
      const contract = await fetchWithCache(file.download_url, `contracts/${file.name}`, 168)
      allContracts.push(contract)
      
      const giver = contract.MissionGiver || ''
      const title = contract.Title || contract.DisplayDescription?.split('\n')[0] || ''
      const giverSlug = slugifyGiver(giver)
      const lookupKey = missionLookupKey(giverSlug, title)
      
      if (!contractIndex.has(lookupKey)) {
        contractIndex.set(lookupKey, [])
      }
      contractIndex.get(lookupKey).push({
        uuid: contract.UUID,
        giver,
        giverSlug,
        title,
        titleNormalized: normalizeMissionTitle(title),
        minStanding: contract.MinStanding,
        maxStanding: contract.MaxStanding,
        rankIndex: contract.RankIndex,
        reputationGained: contract.ReputationGained,
        faction: contract.Faction,
      })
      
      processed++
      if (processed % 100 === 0) {
        process.stdout.write(`\r  Processed ${processed}/${contractFiles.length} contracts...`)
      }
    } catch (e) {
      // Skip failed contracts
    }
  }
  console.log(`\n  Indexed ${contractIndex.size} unique mission keys\n`)
  
  // Also build a fuzzy index by title only (for cross-giver matching)
  const titleIndex = new Map()
  for (const contract of allContracts) {
    const title = normalizeMissionTitle(contract.Title || '')
    if (!title) continue
    if (!titleIndex.has(title)) titleIndex.set(title, [])
    titleIndex.get(title).push(contract)
  }
  
  // Match our missions against scunpacked contracts
  console.log('Matching missions...\n')
  
  let enriched = 0
  let notFound = 0
  const enrichmentLog = []
  
  for (const [key, mission] of Object.entries(acquisition.missionsByLabel)) {
    // Skip if already has rep data
    if (mission.minReputation !== null || mission.minStandingName !== null) {
      continue
    }
    
    // Try exact key match first
    let matches = contractIndex.get(key)
    
    // If no exact match, try title-only match
    if (!matches || matches.length === 0) {
      const titleNorm = key.split('|')[1]
      const titleMatches = titleIndex.get(titleNorm)
      if (titleMatches && titleMatches.length > 0) {
        matches = titleMatches.map(c => ({
          uuid: c.UUID,
          giver: c.MissionGiver,
          title: c.Title,
          minStanding: c.MinStanding,
          maxStanding: c.MaxStanding,
          rankIndex: c.RankIndex,
        }))
      }
    }
    
    if (matches && matches.length > 0) {
      // Find the one with the lowest minReputation (easiest entry point)
      const best = matches.reduce((a, b) => {
        const aRep = a.minStanding?.MinReputation ?? Infinity
        const bRep = b.minStanding?.MinReputation ?? Infinity
        return aRep < bRep ? a : b
      })
      
      if (best.minStanding) {
        mission.minReputation = best.minStanding.MinReputation ?? null
        mission.minStandingName = best.minStanding.Name ?? null
        enriched++
        
        enrichmentLog.push({
          key,
          label: mission.sourceLabel,
          matched: best.title,
          minReputation: mission.minReputation,
          minStandingName: mission.minStandingName,
        })
        
        console.log(`  ✓ ${mission.missionGiver}: ${mission.sourceLabel?.split(':')[1]?.trim() || key}`)
        console.log(`    → ${best.minStanding.Name} (${best.minStanding.MinReputation} rep)`)
      }
    } else {
      notFound++
      enrichmentLog.push({
        key,
        label: mission.sourceLabel,
        matched: null,
        error: 'No matching contract found in scunpacked-data',
      })
    }
  }
  
  // Update blueprint unlock info based on enriched missions
  console.log('\nUpdating blueprint unlock info...')
  let bpUpdated = 0
  
  for (const [bpId, bp] of Object.entries(acquisition.blueprints)) {
    if (bp.unlockMinReputation !== null || bp.isAvailableByDefault) continue
    if (!bp.missionMatches || bp.missionMatches.length === 0) continue
    
    // Find the easiest mission unlock
    let easiest = null
    for (const match of bp.missionMatches) {
      const missionData = acquisition.missionsByLabel[match.lookupKey]
      if (!missionData) continue
      if (missionData.minReputation === null) continue
      
      if (!easiest || (missionData.minReputation < easiest.minReputation)) {
        easiest = {
          minReputation: missionData.minReputation,
          minStandingName: missionData.minStandingName,
        }
      }
    }
    
    if (easiest) {
      bp.unlockMinReputation = easiest.minReputation
      bp.unlockStandingName = easiest.minStandingName
      bpUpdated++
    }
  }
  
  // Write updated acquisition data
  acquisition.scunpackedEnrichment = {
    enrichedAt: new Date().toISOString(),
    contractsIndexed: allContracts.length,
    missionsEnriched: enriched,
    missionsNotFound: notFound,
    blueprintsUpdated: bpUpdated,
  }
  
  writeFileSync(acquisitionPath, JSON.stringify(acquisition, null, 2) + '\n')
  
  // Write enrichment log
  const logPath = join(cacheDir, 'enrichment-log.json')
  writeFileSync(logPath, JSON.stringify(enrichmentLog, null, 2))
  
  console.log('\n=== Summary ===')
  console.log(`Contracts indexed: ${allContracts.length}`)
  console.log(`Missions enriched: ${enriched}`)
  console.log(`Missions not found: ${notFound}`)
  console.log(`Blueprints updated: ${bpUpdated}`)
  console.log(`\nEnrichment log: ${logPath}`)
  console.log(`Updated: ${acquisitionPath}`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
