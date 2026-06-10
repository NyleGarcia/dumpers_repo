/**
 * Enrich mission data from MrKraken's StarStrings localization pack.
 * 
 * This script parses contracts.ini and global.ini to extract:
 * - Blueprint pools per mission
 * - Standing level requirements (Neutral, Jr. Contractor, etc.)
 * - Reputation awarded amounts
 * 
 * Run: node scripts/enrich-from-starstrings.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const acquisitionPath = join(root, 'src', 'data', 'blueprint-acquisition.json')

// Path to StarStrings data - adjust if needed
const STARSTRINGS_PATH = 'F:\\SC Profiles\\StarStrings-master'
const contractsPath = join(STARSTRINGS_PATH, 'contracts.ini')
const globalPath = join(STARSTRINGS_PATH, 'Data', 'Localization', 'english', 'global.ini')

// Standing levels mapped to approximate rep values
const STANDING_LEVELS = {
  'neutral': { minReputation: 0, standingName: 'Neutral' },
  'jr. contractor': { minReputation: 800, standingName: 'Jr. Contractor' },
  'jr contractor': { minReputation: 800, standingName: 'Jr. Contractor' },
  'junior contractor': { minReputation: 800, standingName: 'Jr. Contractor' },
  'contractor': { minReputation: 2200, standingName: 'Contractor' },
  'sr. contractor': { minReputation: 5800, standingName: 'Sr. Contractor' },
  'sr contractor': { minReputation: 5800, standingName: 'Sr. Contractor' },
  'senior contractor': { minReputation: 5800, standingName: 'Sr. Contractor' },
  'veteran contractor': { minReputation: 15000, standingName: 'Veteran Contractor' },
  'head contractor': { minReputation: 38000, standingName: 'Head Contractor' },
}

// Mission giver name mappings
const GIVER_ALIASES = {
  'eckhart': 'eckhartsecurity',
  'eckhart security': 'eckhartsecurity',
  'miles eckhart': 'eckhartsecurity',
  'cfp': 'citizensforprosperity',
  'citizens for prosperity': 'citizensforprosperity',
  'bounty hunters guild': 'bountyhuntersguild',
  'bhg': 'bountyhuntersguild',
  'northrock': 'bountyhuntersguild',
  'covalex': 'covalex',
  'covalex shipping': 'covalex',
  'ling family': 'lingfamilyhauling',
  'ling family hauling': 'lingfamilyhauling',
  'ftl': 'ftl',
  'adagio': 'adagioholdings',
  'adagio holdings': 'adagioholdings',
  'rayari': 'rayariinc',
  'rain': 'rayariinc',
  'highpoint': 'highpoint',
  'highpoint wilderness': 'highpoint',
  'headhunters': 'headhunters',
  'wikelo': 'wikelo',
  'the collector': 'wikelo',
  'vaughn': 'vaughn',
  'hurston dynamics': 'hurstondynamics',
  'constantine hurston': 'hurstondynamics',
  'crusader': 'crusaderindustries',
  'crusader industries': 'crusaderindustries',
  'microtech': 'microtechcorp',
  'arccorp': 'arccorp',
  'shubin': 'shubininterstellar',
  'shubin interstellar': 'shubininterstellar',
  'foxwell': 'foxwellenforcement',
  'foxwell enforcement': 'foxwellenforcement',
}

function parseStandingLevel(text) {
  const lower = text.toLowerCase()
  for (const [key, value] of Object.entries(STANDING_LEVELS)) {
    if (lower.includes(key)) {
      return value
    }
  }
  return null
}

function extractGiverSlug(key) {
  // Extract giver from key like "Eckhart_EscortShips_E_desc"
  const parts = key.split('_')
  if (parts.length > 0) {
    const giver = parts[0].toLowerCase()
    return GIVER_ALIASES[giver] || giver
  }
  return null
}

function normalizeMissionTitle(title) {
  return title
    .replace(/~mission\s*\(\s*Location[^)]*\)/gi, '[location]')
    .replace(/~mission\s*\(\s*TargetName[^)]*\)/gi, '[target]')
    .replace(/~mission\s*\(\s*Danger[^)]*\)/gi, '[danger]')
    .replace(/~mission\s*\([^)]*\)/gi, '[param]')
    .replace(/\[Location[^\]]*\]/gi, '[location]')
    .replace(/\[TargetName[^\]]*\]/gi, '[target]')
    .replace(/\bat\s+[a-z0-9][\w\s'-]{1,40}?\s+(offline|online)\b/gi, 'at [location] $1')
    .replace(/\bverified bounty:\s*.+$/gi, 'verified bounty: [target]')
    .replace(/\bwanted:\s*.+$/gi, 'wanted: [target]')
    .replace(/\bgreen light on\s+.+/gi, 'green light on [target]')
    .replace(/uninitialized/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseIniFile(content) {
  const entries = {}
  const lines = content.split('\n')
  
  for (const line of lines) {
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    
    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1).trim()
    entries[key] = value
  }
  
  return entries
}

function extractMissionData(entries) {
  const missions = []
  
  for (const [key, value] of Object.entries(entries)) {
    // Skip non-mission entries
    if (!key.includes('_desc') && !key.includes('_Desc') && !key.includes('Description')) continue
    
    const data = {
      key,
      giverSlug: extractGiverSlug(key),
      repAwarded: null,
      standingLevel: null,
      blueprints: [],
      rawText: value,
    }
    
    // Extract reputation awarded
    const repMatch = value.match(/Reputation Awarded[^:]*:\s*<\/EM4>\s*(\d[\d,]*)/i)
    if (repMatch) {
      data.repAwarded = parseInt(repMatch[1].replace(/,/g, ''), 10)
    }
    
    // Alternative rep format
    const repMatch2 = value.match(/Reputation Awarded[^:]*:\s*(\d[\d,]*)/i)
    if (!data.repAwarded && repMatch2) {
      data.repAwarded = parseInt(repMatch2[1].replace(/,/g, ''), 10)
    }
    
    // Extract standing level requirement
    const standingMatch = value.match(/Awarded from\s+([^<\n]+?)\s+level/i)
    if (standingMatch) {
      data.standingLevel = parseStandingLevel(standingMatch[1])
    }
    
    // Extract blueprints
    const bpSection = value.match(/Potential Blueprints[^-]*(-[^\n]+(?:\n-[^\n]+)*)/i)
    if (bpSection) {
      const bpLines = bpSection[1].split('\n')
      for (const line of bpLines) {
        const bpMatch = line.match(/^-\s*(.+)/)
        if (bpMatch) {
          const bpName = bpMatch[1]
            .replace(/\\n/g, '')
            .replace(/<[^>]+>/g, '')
            .trim()
          if (bpName && bpName.length > 2) {
            data.blueprints.push(bpName)
          }
        }
      }
    }
    
    // Also look for Pool format
    const poolMatch = value.match(/Pool \d[^-]*(-[^\n]+(?:\n-[^\n]+)*)/gi)
    if (poolMatch) {
      for (const pool of poolMatch) {
        const bpLines = pool.split('\n')
        for (const line of bpLines) {
          const bpMatch = line.match(/^-\s*(.+)/)
          if (bpMatch) {
            const bpName = bpMatch[1]
              .replace(/\\n/g, '')
              .replace(/<[^>]+>/g, '')
              .trim()
            if (bpName && bpName.length > 2 && !data.blueprints.includes(bpName)) {
              data.blueprints.push(bpName)
            }
          }
        }
      }
    }
    
    if (data.repAwarded || data.standingLevel || data.blueprints.length > 0) {
      missions.push(data)
    }
  }
  
  return missions
}

function buildMissionIndex(missions) {
  const index = new Map()
  
  for (const mission of missions) {
    if (!mission.giverSlug) continue
    
    // Create various lookup keys
    const keyParts = mission.key.split('_')
    const missionType = keyParts.slice(1, -1).join('_').toLowerCase()
    
    const lookupKey = `${mission.giverSlug}|${missionType}`
    
    if (!index.has(lookupKey)) {
      index.set(lookupKey, [])
    }
    index.get(lookupKey).push(mission)
    
    // Also index by giver only for fallback matching
    const giverKey = mission.giverSlug
    if (!index.has(giverKey)) {
      index.set(giverKey, [])
    }
    index.get(giverKey).push(mission)
  }
  
  return index
}

async function main() {
  console.log('Enriching from StarStrings data...\n')
  
  // Check if StarStrings files exist
  if (!existsSync(contractsPath)) {
    throw new Error(`StarStrings contracts.ini not found at: ${contractsPath}`)
  }
  if (!existsSync(globalPath)) {
    throw new Error(`StarStrings global.ini not found at: ${globalPath}`)
  }
  
  // Load acquisition data
  const acquisition = JSON.parse(readFileSync(acquisitionPath, 'utf8'))
  
  // Parse StarStrings files
  console.log('Parsing contracts.ini...')
  const contractsContent = readFileSync(contractsPath, 'utf8')
  const contractsEntries = parseIniFile(contractsContent)
  const contractsMissions = extractMissionData(contractsEntries)
  console.log(`  Found ${contractsMissions.length} missions with useful data`)
  
  console.log('Parsing global.ini...')
  const globalContent = readFileSync(globalPath, 'utf8')
  const globalEntries = parseIniFile(globalContent)
  const globalMissions = extractMissionData(globalEntries)
  console.log(`  Found ${globalMissions.length} missions with useful data`)
  
  // Combine and dedupe
  const allMissions = [...contractsMissions]
  const seenKeys = new Set(contractsMissions.map(m => m.key))
  for (const m of globalMissions) {
    if (!seenKeys.has(m.key)) {
      allMissions.push(m)
      seenKeys.add(m.key)
    }
  }
  console.log(`\nTotal unique mission entries: ${allMissions.length}`)
  
  // Build lookup index
  const missionIndex = buildMissionIndex(allMissions)
  
  // Stats
  const stats = {
    missionsWithStanding: allMissions.filter(m => m.standingLevel).length,
    missionsWithBlueprints: allMissions.filter(m => m.blueprints.length > 0).length,
    missionsWithRep: allMissions.filter(m => m.repAwarded).length,
    uniqueBlueprints: new Set(allMissions.flatMap(m => m.blueprints)).size,
  }
  
  console.log('\n=== StarStrings Data Stats ===')
  console.log(`Missions with standing level: ${stats.missionsWithStanding}`)
  console.log(`Missions with blueprints: ${stats.missionsWithBlueprints}`)
  console.log(`Missions with rep awarded: ${stats.missionsWithRep}`)
  console.log(`Unique blueprints found: ${stats.uniqueBlueprints}`)
  
  // Cross-reference with our acquisition data
  console.log('\n=== Cross-referencing with acquisition data ===')
  
  let enriched = 0
  let bpMatched = 0
  const enrichmentLog = []
  
  // Try to match our missions with StarStrings data
  for (const [key, mission] of Object.entries(acquisition.missionsByLabel)) {
    // Skip if already has rep data
    if (mission.minReputation !== null && mission.minStandingName !== null) {
      continue
    }
    
    const giverSlug = mission.giverSlug || key.split('|')[0]
    
    // Try to find a match in StarStrings
    let matched = null
    
    // Try giver-based matching
    const giverMissions = missionIndex.get(giverSlug) || []
    if (giverMissions.length > 0) {
      // Find the one with standing data that seems to match
      for (const ssm of giverMissions) {
        if (ssm.standingLevel) {
          // Check if any blueprints match
          if (mission.sourceLabel) {
            const missionTitle = mission.sourceLabel.split(':').slice(-1)[0]?.trim().toLowerCase() || ''
            const ssmTitle = ssm.key.toLowerCase()
            
            // Loose matching - if same giver and has standing data, consider it a potential match
            if (ssmTitle.includes(giverSlug) || ssm.giverSlug === giverSlug) {
              matched = ssm
              break
            }
          }
        }
      }
    }
    
    if (matched && matched.standingLevel) {
      mission.minReputation = matched.standingLevel.minReputation
      mission.minStandingName = matched.standingLevel.standingName
      mission._starstringsEnriched = true
      enriched++
      
      enrichmentLog.push({
        key,
        label: mission.sourceLabel,
        matchedKey: matched.key,
        standing: matched.standingLevel,
      })
      
      console.log(`  ✓ ${mission.missionGiver}: ${mission.sourceLabel?.split(':')[1]?.trim() || key}`)
      console.log(`    → ${matched.standingLevel.standingName} (${matched.standingLevel.minReputation} rep)`)
    }
  }
  
  // Update blueprint data with StarStrings info
  console.log('\n=== Updating blueprint data ===')
  
  // Build a map of blueprint names to standing levels
  const bpStandingMap = new Map()
  for (const mission of allMissions) {
    if (!mission.standingLevel || mission.blueprints.length === 0) continue
    
    for (const bp of mission.blueprints) {
      const bpKey = bp.toLowerCase().trim()
      if (!bpStandingMap.has(bpKey) || 
          bpStandingMap.get(bpKey).minReputation > mission.standingLevel.minReputation) {
        bpStandingMap.set(bpKey, {
          standing: mission.standingLevel,
          missionKey: mission.key,
          giverSlug: mission.giverSlug,
        })
      }
    }
  }
  
  console.log(`Built blueprint->standing map with ${bpStandingMap.size} entries`)
  
  // Update blueprints that are missing unlock info
  let bpUpdated = 0
  for (const [bpId, bp] of Object.entries(acquisition.blueprints)) {
    if (bp.unlockMinReputation !== null || bp.isAvailableByDefault) continue
    
    // Try to match by blueprint name
    const bpName = bp.blueprintName?.toLowerCase().trim()
    if (!bpName) continue
    
    // Check direct match
    let match = bpStandingMap.get(bpName)
    
    // Try partial match
    if (!match) {
      for (const [key, value] of bpStandingMap) {
        if (bpName.includes(key) || key.includes(bpName)) {
          match = value
          break
        }
      }
    }
    
    if (match) {
      bp.unlockMinReputation = match.standing.minReputation
      bp.unlockStandingName = match.standing.standingName
      bp._starstringsEnriched = true
      bpUpdated++
      bpMatched++
    }
  }
  
  console.log(`Updated ${bpUpdated} blueprints with standing info from StarStrings`)
  
  // Save extracted data for reference
  const extractedData = {
    extractedAt: new Date().toISOString(),
    source: 'StarStrings by MrKraken',
    stats: {
      totalMissions: allMissions.length,
      ...stats,
      enrichedMissions: enriched,
      enrichedBlueprints: bpMatched,
    },
    standingLevels: STANDING_LEVELS,
    blueprintStandingMap: Object.fromEntries(
      [...bpStandingMap.entries()].map(([k, v]) => [k, v.standing])
    ),
  }
  
  const extractedPath = join(root, 'src', 'data', 'starstrings-extracted.json')
  writeFileSync(extractedPath, JSON.stringify(extractedData, null, 2) + '\n')
  console.log(`\nExtracted data saved to: ${extractedPath}`)
  
  // Update acquisition data
  acquisition.starstringsEnrichment = {
    enrichedAt: new Date().toISOString(),
    source: 'StarStrings by MrKraken',
    missionsEnriched: enriched,
    blueprintsEnriched: bpMatched,
  }
  
  writeFileSync(acquisitionPath, JSON.stringify(acquisition, null, 2) + '\n')
  
  console.log('\n=== Summary ===')
  console.log(`Missions enriched: ${enriched}`)
  console.log(`Blueprints enriched: ${bpMatched}`)
  console.log(`Updated: ${acquisitionPath}`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
