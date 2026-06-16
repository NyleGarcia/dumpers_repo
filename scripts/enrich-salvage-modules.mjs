/**
 * Enriches Blueprints.json with salvage module stats from star-citizen.wiki API
 * 
 * Run after fetch-blueprints.mjs to add missing salvage module stats:
 *   node scripts/enrich-salvage-modules.mjs
 * 
 * This script fetches salvage module specifications from the star-citizen.wiki API
 * and populates the null hull scraping stats in vehicleBaseStats.
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
 * e.g., "Trawler Scraper Module" -> "trawler-scraper-module"
 */
function toApiSlug(blueprintName) {
  return blueprintName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Fetch salvage module data from star-citizen.wiki API
 */
async function fetchSalvageData(slug) {
  const url = `${API_BASE}/${slug}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`  API returned ${response.status} for ${slug}`)
      return null
    }
    
    const json = await response.json()
    const data = json.data
    
    if (!data?.weapon_modifier?.salvage) {
      console.warn(`  No weapon_modifier.salvage data for ${slug}`)
      return null
    }
    
    const salvage = data.weapon_modifier.salvage
    
    return {
      speed: salvage.salvage_speed_multiplier ?? null,
      radius: salvage.radius_multiplier ?? null,
      efficiency: salvage.extraction_efficiency ?? null,
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
  
  // Find all salvage modules
  const salvageModules = data.blueprints.filter(bp => bp.subCategoryName === 'salvage')
  console.log(`Found ${salvageModules.length} salvage modules\n`)
  
  let enriched = 0
  let skipped = 0
  let failed = 0
  
  // Track unique names to avoid duplicate API calls
  const processed = new Set()
  
  for (const module of salvageModules) {
    const slug = toApiSlug(module.blueprintName)
    
    // Skip if we already processed this name
    if (processed.has(slug)) {
      console.log(`Skipping duplicate: ${module.blueprintName}`)
      continue
    }
    processed.add(slug)
    
    console.log(`Fetching: ${module.blueprintName} (${slug})`)
    
    // Check if already has efficiency value
    if (module.vehicleBaseStats?.Weapon_Hullscraping_Efficiency != null) {
      console.log(`  Already has value: ${module.vehicleBaseStats.Weapon_Hullscraping_Efficiency}`)
      skipped++
      continue
    }
    
    const salvageData = await fetchSalvageData(slug)
    
    if (salvageData && salvageData.efficiency !== null) {
      // Initialize vehicleBaseStats if needed
      if (!module.vehicleBaseStats) {
        module.vehicleBaseStats = {}
      }
      
      // Set salvage stats (convert to percentage for display)
      if (salvageData.efficiency !== null) {
        module.vehicleBaseStats.Weapon_Hullscraping_Efficiency = Math.round(salvageData.efficiency * 100)
      }
      if (salvageData.radius !== null) {
        module.vehicleBaseStats.Weapon_Hullscraping_Radius = salvageData.radius
      }
      if (salvageData.speed !== null) {
        module.vehicleBaseStats.Weapon_Hullscraping_Speed = salvageData.speed
      }
      
      console.log(`  ✓ Efficiency: ${salvageData.efficiency * 100}%, Radius: ${salvageData.radius}m, Speed: ${salvageData.speed}`)
      enriched++
      
      // Also update any duplicates with same name
      for (const dup of salvageModules) {
        if (dup.blueprintName === module.blueprintName && dup !== module) {
          dup.vehicleBaseStats = { ...module.vehicleBaseStats }
        }
      }
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
  console.log(`Total unique: ${processed.size}`)
}

main().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
