/**
 * Infer mission rep requirements based on contract level patterns.
 * 
 * Patterns discovered from scunpacked-data:
 * - Yellow Level: 0-800 rep (Neutral to Jr. Contractor)
 * - Orange Level: 2200-5800 rep (Contractor to Sr. Contractor)  
 * - Red Level: 5800-38000 rep (Sr. Contractor to Head Contractor)
 * 
 * This script fills in gaps where we can make educated guesses.
 * 
 * Run: node scripts/infer-mission-rep.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const acquisitionPath = join(root, 'src', 'data', 'blueprint-acquisition.json')

// Inferred rep patterns from scunpacked data analysis
const REP_PATTERNS = {
  yellow: { minReputation: 0, standingName: 'Neutral' },
  orange: { minReputation: 2200, standingName: 'Contractor' },
  red: { minReputation: 5800, standingName: 'Sr. Contractor' },
}

// Faction-specific rep ladders (simplified)
const FACTION_LADDERS = {
  foxwell: [
    { name: 'Applicant', min: 0 },
    { name: 'Neutral', min: 0 },
    { name: 'Jr. Contractor', min: 800 },
    { name: 'Contractor', min: 2200 },
    { name: 'Sr. Contractor', min: 5800 },
    { name: 'Veteran Contractor', min: 15000 },
    { name: 'Head Contractor', min: 38000 },
  ],
  headhunters: [
    { name: 'Neutral', min: 0 },
    { name: 'Associate', min: 500 },
    { name: 'Member', min: 2000 },
    { name: 'Trusted', min: 5000 },
    { name: 'Elite', min: 15000 },
  ],
  hockrow: [
    { name: 'Neutral', min: 0 },
    { name: 'Contact', min: 1000 },
    { name: 'Asset', min: 5000 },
    { name: 'Agent', min: 15000 },
  ],
  wikelo: [
    { name: 'Neutral', min: 0 },
    { name: 'Friend', min: 500 },
    { name: 'Trusted', min: 2000 },
  ],
}

function inferRepFromTitle(title, giverSlug) {
  const t = title.toLowerCase()
  
  // Level-based inference
  if (t.includes('yellow level') || t.includes('yellow lvl')) {
    return { minReputation: 0, standingName: 'Neutral' }
  }
  if (t.includes('orange level') || t.includes('orange lvl')) {
    return { minReputation: 2200, standingName: 'Contractor' }
  }
  if (t.includes('red level') || t.includes('red lvl')) {
    return { minReputation: 5800, standingName: 'Sr. Contractor' }
  }
  
  // Faction-specific inference
  const ladder = FACTION_LADDERS[giverSlug]
  if (!ladder) return null
  
  // Default to lowest non-zero tier for faction missions
  return { 
    minReputation: ladder[0].min, 
    standingName: ladder[0].name 
  }
}

async function main() {
  console.log('Inferring mission rep requirements...\n')
  
  const acquisition = JSON.parse(readFileSync(acquisitionPath, 'utf8'))
  
  let inferred = 0
  const inferenceLog = []
  
  for (const [key, mission] of Object.entries(acquisition.missionsByLabel)) {
    // Skip if already has rep data
    if (mission.minReputation !== null || mission.minStandingName !== null) {
      continue
    }
    
    const title = mission.sccrafterLabel || key.split('|')[1] || ''
    const giverSlug = mission.giverSlug || key.split('|')[0] || ''
    
    const inference = inferRepFromTitle(title, giverSlug)
    
    if (inference) {
      mission.minReputation = inference.minReputation
      mission.minStandingName = inference.standingName
      mission._inferred = true
      inferred++
      
      inferenceLog.push({
        key,
        label: mission.sccrafterLabel,
        giver: mission.missionGiver,
        inferred: inference,
      })
      
      console.log(`  ✓ ${mission.missionGiver}: ${title.split(':').slice(-1)[0]?.trim() || title}`)
      console.log(`    → ${inference.standingName} (${inference.minReputation} rep) [inferred]`)
    }
  }
  
  // Update blueprint unlock info
  console.log('\nUpdating blueprint unlock info...')
  let bpUpdated = 0
  
  for (const [bpId, bp] of Object.entries(acquisition.blueprints)) {
    if (bp.unlockMinReputation !== null || bp.isAvailableByDefault) continue
    if (!bp.missionMatches || bp.missionMatches.length === 0) continue
    
    let easiest = null
    for (const match of bp.missionMatches) {
      const missionData = acquisition.missionsByLabel[match.lookupKey]
      if (!missionData) continue
      if (missionData.minReputation === null) continue
      
      if (!easiest || (missionData.minReputation < easiest.minReputation)) {
        easiest = {
          minReputation: missionData.minReputation,
          minStandingName: missionData.minStandingName,
          inferred: missionData._inferred,
        }
      }
    }
    
    if (easiest) {
      bp.unlockMinReputation = easiest.minReputation
      bp.unlockStandingName = easiest.minStandingName
      if (easiest.inferred) bp._unlockInferred = true
      bpUpdated++
    }
  }
  
  // Update stats
  acquisition.repInference = {
    inferredAt: new Date().toISOString(),
    missionsInferred: inferred,
    blueprintsUpdated: bpUpdated,
    patterns: REP_PATTERNS,
  }
  
  writeFileSync(acquisitionPath, JSON.stringify(acquisition, null, 2) + '\n')
  
  console.log('\n=== Summary ===')
  console.log(`Missions inferred: ${inferred}`)
  console.log(`Blueprints updated: ${bpUpdated}`)
  console.log(`\nUpdated: ${acquisitionPath}`)
  
  // Show remaining unknowns
  const stillUnknown = Object.entries(acquisition.missionsByLabel)
    .filter(([k, m]) => m.minReputation === null && m.minStandingName === null)
  
  if (stillUnknown.length > 0) {
    console.log(`\nRemaining unknowns: ${stillUnknown.length}`)
    stillUnknown.slice(0, 10).forEach(([k, m]) => {
      console.log(`  - ${m.missionGiver}: ${m.sccrafterLabel?.split(':').slice(-1)[0]?.trim() || k}`)
    })
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
