/**
 * Enriches Blueprints.json with FPS weapon stats from star-citizen.wiki API
 * 
 * Run after fetch-blueprints.mjs to add missing FPS weapon stats:
 *   node scripts/enrich-fps-weapons.mjs
 * 
 * This script fetches FPS weapon specifications from the star-citizen.wiki API
 * and populates the null weapon stats in weaponBaseStats.
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
 * e.g., "Novian Crossbow" -> "novian-crossbow"
 */
function toApiSlug(blueprintName) {
  return blueprintName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Fetch FPS weapon data from star-citizen.wiki API
 */
async function fetchWeaponData(slug) {
  const url = `${API_BASE}/${slug}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`  API returned ${response.status} for ${slug}`)
      return null
    }
    
    const json = await response.json()
    const data = json.data
    
    if (!data?.personal_weapon) {
      console.warn(`  No personal_weapon data for ${slug}`)
      return null
    }
    
    const pw = data.personal_weapon
    
    return {
      damage: pw.damage?.alpha_total ?? pw.damage_per_shot ?? null,
      rpm: pw.rpm ?? pw.rof ?? null,
      range: pw.range ?? pw.effective_range ?? null,
      magazineSize: pw.capacity ?? pw.magazine_size ?? null,
      spread: pw.spread?.max ?? null,
      spreadMin: pw.spread?.min ?? null,
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
  
  // Find all FPS weapons (not armor)
  const fpsWeapons = data.blueprints.filter(bp => bp.categoryName === 'FPSWeapons')
  console.log(`Found ${fpsWeapons.length} FPS weapons\n`)
  
  let enriched = 0
  let skipped = 0
  let failed = 0
  
  for (const weapon of fpsWeapons) {
    const slug = toApiSlug(weapon.blueprintName)
    console.log(`Fetching: ${weapon.blueprintName} (${slug})`)
    
    // Check if already has damage value
    if (weapon.weaponBaseStats?.Weapon_Damage != null) {
      console.log(`  Already has value: ${weapon.weaponBaseStats.Weapon_Damage}`)
      skipped++
      continue
    }
    
    const weaponData = await fetchWeaponData(slug)
    
    if (weaponData && weaponData.damage) {
      // Initialize weaponBaseStats if needed
      if (!weapon.weaponBaseStats) {
        weapon.weaponBaseStats = {}
      }
      
      // Set weapon stats
      weapon.weaponBaseStats.Weapon_Damage = weaponData.damage
      
      if (weaponData.rpm) {
        weapon.weaponBaseStats.Weapon_Firerate = weaponData.rpm
      }
      if (weaponData.range) {
        weapon.weaponBaseStats.Weapon_Range = weaponData.range
      }
      if (weaponData.spread) {
        weapon.weaponBaseStats.Weapon_Spread = weaponData.spread
      }
      if (weaponData.magazineSize) {
        weapon.weaponBaseStats.Weapon_MagazineSize = weaponData.magazineSize
      }
      
      console.log(`  ✓ Damage: ${weaponData.damage}, RPM: ${weaponData.rpm}, Range: ${weaponData.range}`)
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
  console.log(`Total: ${fpsWeapons.length}`)
}

main().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
