/**
 * Fetch mission/contract data from StarCitizenWiki/scunpacked-data repository
 * and cross-reference with our unmatched missions to fill in rep gaps.
 * 
 * Data source: https://github.com/StarCitizenWiki/scunpacked-data
 * 
 * Run: node scripts/fetch-scunpacked-missions.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, 'scripts', '.cache', 'scunpacked')
const outputPath = join(root, 'scripts', '.cache', 'scunpacked-missions-analysis.json')
const acquisitionPath = join(root, 'src', 'data', 'blueprint-acquisition.json')

const SCUNPACKED_RAW = 'https://raw.githubusercontent.com/StarCitizenWiki/scunpacked-data/master'
const GITHUB_API = 'https://api.github.com/repos/StarCitizenWiki/scunpacked-data/contents'

async function fetchJson(url) {
  console.log(`  Fetching: ${url.slice(0, 80)}...`)
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'DumpersRepo/1.0'
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json()
}

async function fetchWithCache(url, cacheFile) {
  const cachePath = join(cacheDir, cacheFile)
  
  if (existsSync(cachePath)) {
    const stat = await import('fs').then(fs => fs.statSync(cachePath))
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)
    if (ageHours < 24) {
      console.log(`  Using cached: ${cacheFile} (${ageHours.toFixed(1)}h old)`)
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
    .replace(/~mission\s*\([^)]*\)/gi, '[param]')
    .replace(/\[Location[^\]]*\]/gi, '[location]')
    .replace(/\[NearbyLocation[^\]]*\]/gi, '[location]')
    .replace(/\[TargetName[^\]]*\]/gi, '[target]')
    .replace(/\[Danger[^\]]*\]/gi, '[danger]')
    .replace(/\bat\s+[a-z0-9][\w\s'-]{1,40}?\s+(offline|online)\b/gi, 'at [location] $1')
    .replace(/\brally at\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'rally at [location]')
    .replace(/\bat\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'at [location]')
    .replace(/\bnear\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'near [location]')
    .replace(/\bverified bounty:\s*.+$/gi, 'verified bounty: [target]')
    .replace(/\bbounty assignment:\s*.+$/gi, 'bounty assignment: [target]')
    .replace(/\bwanted:\s*.+$/gi, 'wanted: [target]')
    .replace(/\bgreen light on\s+.+/gi, 'green light on [target]')
    .replace(/uninitialized/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

async function main() {
  console.log('Fetching scunpacked-data mission/contract information...\n')
  
  mkdirSync(cacheDir, { recursive: true })
  
  // Load our current acquisition data to find unmatched missions
  const acquisition = JSON.parse(readFileSync(acquisitionPath, 'utf8'))
  const ourMissions = acquisition.missionsByLabel
  
  // Find all missions that have null rep data
  const missionsNeedingRep = []
  for (const [key, mission] of Object.entries(ourMissions)) {
    if (mission.minReputation === null && mission.minStandingName === null) {
      missionsNeedingRep.push({ key, ...mission })
    }
  }
  
  console.log(`Found ${missionsNeedingRep.length} missions without rep data in our system:\n`)
  missionsNeedingRep.forEach(m => {
    console.log(`  - ${m.missionGiver}: ${m.sccrafterLabel?.split(':')[1]?.trim() || m.key}`)
  })
  
  // Fetch factions data from scunpacked-data
  console.log('\nFetching faction data...')
  const factionsDir = await fetchWithCache(`${GITHUB_API}/factions`, 'factions-dir.json')
  
  const factionData = {}
  for (const file of factionsDir.slice(0, 30)) { // Limit to avoid rate limiting
    if (!file.name.endsWith('.json')) continue
    try {
      const faction = await fetchWithCache(file.download_url, `factions/${file.name}`)
      const slug = slugifyGiver(faction.name || file.name.replace('.json', ''))
      factionData[slug] = faction
      console.log(`    Loaded faction: ${faction.name || file.name}`)
    } catch (e) {
      console.log(`    Failed: ${file.name} - ${e.message}`)
    }
  }
  
  // Fetch contracts data
  console.log('\nFetching contracts directory...')
  const contractsDir = await fetchWithCache(`${GITHUB_API}/contracts`, 'contracts-dir.json')
  console.log(`  Found ${contractsDir.length} contract files`)
  
  // Sample a few contracts to understand structure
  const sampleContracts = []
  const contractsToSample = contractsDir
    .filter(f => f.name.endsWith('.json'))
    .slice(0, 10)
  
  for (const file of contractsToSample) {
    try {
      const contract = await fetchWithCache(file.download_url, `contracts/${file.name}`)
      sampleContracts.push({ filename: file.name, ...contract })
    } catch (e) {
      console.log(`    Failed: ${file.name}`)
    }
  }
  
  // Analyze what data is available
  console.log('\n=== Sample Contract Structure ===')
  if (sampleContracts.length > 0) {
    const sample = sampleContracts[0]
    console.log('Keys:', Object.keys(sample).join(', '))
    console.log('\nSample contract:', sample.filename)
    console.log(JSON.stringify(sample, null, 2).slice(0, 2000))
  }
  
  // Look for reputation-related fields
  console.log('\n=== Searching for reputation fields ===')
  const repFields = new Set()
  for (const contract of sampleContracts) {
    const findRepFields = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return
      for (const [key, val] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key
        if (/rep|standing|faction|rank/i.test(key)) {
          repFields.add(`${fullPath}: ${JSON.stringify(val).slice(0, 100)}`)
        }
        if (typeof val === 'object') findRepFields(val, fullPath)
      }
    }
    findRepFields(contract)
  }
  
  console.log('Reputation-related fields found:')
  for (const field of repFields) {
    console.log(`  ${field}`)
  }
  
  // Write analysis output
  const analysis = {
    generatedAt: new Date().toISOString(),
    missionsNeedingRep: missionsNeedingRep.length,
    missionsNeedingRepList: missionsNeedingRep,
    factionsLoaded: Object.keys(factionData).length,
    factionSlugs: Object.keys(factionData),
    contractsAvailable: contractsDir.length,
    sampleContracts,
    repFieldsFound: [...repFields],
  }
  
  writeFileSync(outputPath, JSON.stringify(analysis, null, 2))
  console.log(`\nAnalysis written to: ${outputPath}`)
  
  // Summary
  console.log('\n=== Summary ===')
  console.log(`Missions needing rep data: ${missionsNeedingRep.length}`)
  console.log(`Factions loaded: ${Object.keys(factionData).length}`)
  console.log(`Contracts available in scunpacked: ${contractsDir.length}`)
  console.log('\nNext steps:')
  console.log('1. Review the sample contracts to understand the data structure')
  console.log('2. Map contract titles to our mission labels')
  console.log('3. Extract reputation requirements from matched contracts')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
