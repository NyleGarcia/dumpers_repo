/**
 * Enriches Blueprints.json with mining laser power values from star-citizen.wiki API
 * 
 * Run after fetch-blueprints.mjs to add missing mining laser stats:
 *   node scripts/enrich-mining-lasers.mjs
 * 
 * This script fetches mining laser specifications from the star-citizen.wiki API
 * and populates the null Weapon_Damage_Override_Laser values in vehicleBaseStats.
 */

import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const blueprintsPath = join(root, 'public', 'data', 'Blueprints.json')

const API_BASE = 'https://api.star-citizen.wiki/api/v2/items'
const RATE_LIMIT_MS = 300 // Be nice to the API

/**
 * Convert blueprint name to API slug
 * e.g., "Helix II Mining Laser" -> "helix-ii-mining-laser"
 */
function toApiSlug(blueprintName) {
  return blueprintName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Fetch mining laser data from star-citizen.wiki API
 */
async function fetchMiningLaserData(slug) {
  const url = `${API_BASE}/${slug}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`  API returned ${response.status} for ${slug}`)
      return null
    }
    
    const json = await response.json()
    const data = json.data
    
    if (!data?.mining_laser?.laser_power) {
      console.warn(`  No mining_laser.laser_power for ${slug}`)
      return null
    }
    
    return {
      minPower: data.mining_laser.laser_power.min ?? data.mining_laser.laser_power.minimum,
      maxPower: data.mining_laser.laser_power.max ?? data.mining_laser.laser_power.maximum,
      extractionPower: data.mining_laser.extraction_throughput,
      optimalRange: data.mining_laser.optimal_range,
      maxRange: data.mining_laser.maximum_range,
      moduleSlots: data.mining_laser.module_slots,
    }
  } catch (error) {
    console.warn(`  Error fetching ${slug}: ${error.message}`)
    return null
  }
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('Loading Blueprints.json...')
  const data = JSON.parse(readFileSync(blueprintsPath, 'utf8'))
  
  // Find all mining lasers
  const miningLasers = data.blueprints.filter(bp => bp.subCategoryName === 'mininglaser')
  console.log(`Found ${miningLasers.length} mining lasers\n`)
  
  let enriched = 0
  let skipped = 0
  let failed = 0
  
  for (const laser of miningLasers) {
    const slug = toApiSlug(laser.blueprintName)
    console.log(`Fetching: ${laser.blueprintName} (${slug})`)
    
    // Check if already has a value
    if (laser.vehicleBaseStats?.Weapon_Damage_Override_Laser != null) {
      console.log(`  Already has value: ${laser.vehicleBaseStats.Weapon_Damage_Override_Laser}`)
      skipped++
      continue
    }
    
    const laserData = await fetchMiningLaserData(slug)
    
    if (laserData && laserData.maxPower) {
      // Initialize vehicleBaseStats if needed
      if (!laser.vehicleBaseStats) {
        laser.vehicleBaseStats = {}
      }
      
      // Set the max power as the base damage value
      // The quality modifiers will scale this (0.8x at Q0, 1.2x at Q1000)
      laser.vehicleBaseStats.Weapon_Damage_Override_Laser = laserData.maxPower
      
      // Also add extraction power if we have it
      if (laserData.extractionPower) {
        laser.vehicleBaseStats.Mining_ExtractionPower = laserData.extractionPower
      }
      
      // Add range stats if available
      if (laserData.optimalRange) {
        laser.vehicleBaseStats.Mining_OptimalRange = laserData.optimalRange
      }
      if (laserData.maxRange) {
        laser.vehicleBaseStats.Mining_MaxRange = laserData.maxRange
      }
      
      console.log(`  ✓ Power: ${laserData.minPower}-${laserData.maxPower}, Extraction: ${laserData.extractionPower}`)
      enriched++
    } else {
      console.log(`  ✗ Could not fetch data`)
      failed++
    }
    
    // Rate limiting
    await sleep(RATE_LIMIT_MS)
  }
  
  // Write updated data
  console.log('\nWriting updated Blueprints.json...')
  writeFileSync(blueprintsPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  
  console.log('\n=== Summary ===')
  console.log(`Enriched: ${enriched}`)
  console.log(`Skipped (already has value): ${skipped}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${miningLasers.length}`)
}

main().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
