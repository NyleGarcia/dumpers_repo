/**
 * Fetch resource lore/descriptions from star-citizen.wiki API
 * 
 * Usage: node scripts/fetch-resource-lore.mjs
 * 
 * Outputs: public/data/resource-lore.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const outputPath = join(__dirname, '..', 'public', 'data', 'resource-lore.json')

// Rate limiting
const DELAY_MS = 150

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Convert resource key to API slug
 * e.g., "redfin_energy_modulators" -> "redfin-energy-modulators"
 */
function toApiSlug(resourceKey) {
  return resourceKey
    .replace(/_/g, '-')
    .toLowerCase()
}

/**
 * Try multiple slug variations to find the resource
 */
function getSlugVariations(resourceKey, label) {
  const baseSlug = toApiSlug(resourceKey)
  const labelSlug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  
  // Return unique variations to try
  const variations = [baseSlug]
  if (labelSlug !== baseSlug) variations.push(labelSlug)
  
  // Handle special cases
  if (resourceKey === 'e_tam') variations.push('etam')
  if (resourceKey === 'widow') variations.push('widow-drug')
  if (resourceKey === 'rmc') variations.push('recycled-material-composite')
  
  return [...new Set(variations)]
}

/**
 * Fetch lore description from star-citizen.wiki API
 */
async function fetchLore(slug) {
  const url = `https://api.star-citizen.wiki/api/v2/commodities/${slug}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    
    const json = await response.json()
    const description = json?.data?.description
    
    if (description && description.trim() && description !== 'No description available from the API.') {
      return {
        description: description.trim(),
        source_slug: slug,
        source_url: json?.data?.web_url || `https://api.star-citizen.wiki/commodities/${slug}`
      }
    }
    
    return null
  } catch (error) {
    return null
  }
}

/**
 * Extract all unique resources from Blueprints.json and extraResources
 */
function getAllResources() {
  const resources = new Map()
  
  // Load Blueprints.json
  const blueprintsPath = join(__dirname, '..', 'public', 'data', 'Blueprints.json')
  if (existsSync(blueprintsPath)) {
    const blueprintsData = JSON.parse(readFileSync(blueprintsPath, 'utf8'))
    const blueprints = blueprintsData.blueprints || []
    
    for (const bp of blueprints) {
      if (!bp.slots) continue
      for (const slot of bp.slots) {
        if (!slot.options) continue
        for (const opt of slot.options) {
          const name = opt.resourceName || opt.entityName
          if (name && opt.type !== 'item') {
            const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
            if (!resources.has(key)) {
              resources.set(key, { resourceKey: key, label: name })
            }
          }
        }
      }
    }
  }
  
  // Add extra catalog resources
  const extraResources = [
    { resourceKey: 'rmc', label: 'RMC (Recycled Material Composite)' },
    { resourceKey: 'construction_material', label: 'Construction Material' },
    { resourceKey: 'compboard', label: 'Compboard' },
    { resourceKey: 'scrap', label: 'Scrap' },
    { resourceKey: 'waste', label: 'Waste' },
    { resourceKey: 'hydrogen_fuel', label: 'Hydrogen Fuel' },
    { resourceKey: 'quantum_fuel', label: 'Quantum Fuel' },
    { resourceKey: 'anti_hydrogen', label: 'Anti-Hydrogen' },
    { resourceKey: 'argon', label: 'Argon' },
    { resourceKey: 'helium', label: 'Helium' },
    { resourceKey: 'hydrogen', label: 'Hydrogen' },
    { resourceKey: 'nitrogen', label: 'Nitrogen' },
    { resourceKey: 'xenon', label: 'Xenon' },
    { resourceKey: 'altruciatoxin', label: 'Altruciatoxin' },
    { resourceKey: 'e_tam', label: "E'tam" },
    { resourceKey: 'slam', label: 'SLAM' },
    { resourceKey: 'widow', label: 'WiDoW' },
    { resourceKey: 'neon', label: 'Neon' },
    { resourceKey: 'distilled_spirits', label: 'Distilled Spirits' },
    { resourceKey: 'agricultural_supplies', label: 'Agricultural Supplies' },
    { resourceKey: 'fresh_food', label: 'Fresh Food' },
    { resourceKey: 'processed_food', label: 'Processed Food' },
    { resourceKey: 'medical_supplies', label: 'Medical Supplies' },
    { resourceKey: 'diamond', label: 'Diamond' },
    { resourceKey: 'gold', label: 'Gold' },
    { resourceKey: 'titanium', label: 'Titanium' },
    { resourceKey: 'iron', label: 'Iron' },
    { resourceKey: 'copper', label: 'Copper' },
    { resourceKey: 'aluminum', label: 'Aluminum' },
    { resourceKey: 'tungsten', label: 'Tungsten' },
    { resourceKey: 'quantainium', label: 'Quantainium' },
    { resourceKey: 'laranite', label: 'Laranite' },
    { resourceKey: 'agricium', label: 'Agricium' },
    { resourceKey: 'beryl', label: 'Beryl' },
    { resourceKey: 'bexalite', label: 'Bexalite' },
    { resourceKey: 'borase', label: 'Borase' },
    { resourceKey: 'taranite', label: 'Taranite' },
    { resourceKey: 'hadanite', label: 'Hadanite' },
    { resourceKey: 'aphorite', label: 'Aphorite' },
    { resourceKey: 'dolivine', label: 'Dolivine' },
    { resourceKey: 'osoian_hides', label: 'Osoian Hides' },
    { resourceKey: 'redfin_energy_modulators', label: 'Redfin Energy Modulators' },
    { resourceKey: 'human_food_bars', label: 'Human Food Bars' },
    { resourceKey: 'lifecure_medsticks', label: 'LifeCure Medsticks' },
    { resourceKey: 'gasping_weevil_eggs', label: 'Gasping Weevil Eggs' },
    { resourceKey: 'heart_of_the_woods', label: 'Heart of the Woods' },
    { resourceKey: 'golden_medmon', label: 'Golden Medmon' },
    { resourceKey: 'revenant_pod', label: 'Revenant Pod' },
    { resourceKey: 'prota', label: 'Prota' },
    { resourceKey: 'aslarite', label: 'Aslarite' },
    { resourceKey: 'hephaestanite', label: 'Hephaestanite' },
    { resourceKey: 'riccite', label: 'Riccite' },
    { resourceKey: 'stileron', label: 'Stileron' },
  ]
  
  for (const r of extraResources) {
    if (!resources.has(r.resourceKey)) {
      resources.set(r.resourceKey, r)
    }
  }
  
  return Array.from(resources.values())
}

async function main() {
  console.log('Fetching resource lore from star-citizen.wiki API...\n')
  
  const resources = getAllResources()
  console.log(`Found ${resources.length} unique resources to look up\n`)
  
  const loreData = {}
  let found = 0
  let notFound = 0
  
  for (const resource of resources) {
    const slugs = getSlugVariations(resource.resourceKey, resource.label)
    let lore = null
    
    for (const slug of slugs) {
      lore = await fetchLore(slug)
      if (lore) break
      await sleep(DELAY_MS)
    }
    
    if (lore) {
      loreData[resource.resourceKey] = {
        label: resource.label,
        description: lore.description,
        source_url: lore.source_url
      }
      found++
      console.log(`✓ ${resource.label}`)
    } else {
      notFound++
      // Only log if it seems like it should have lore (not basic elements/gases)
      const basicItems = ['hydrogen', 'nitrogen', 'argon', 'helium', 'xenon', 'krypton', 'methane', 'tritium']
      if (!basicItems.includes(resource.resourceKey)) {
        console.log(`  (no lore) ${resource.label}`)
      }
    }
    
    await sleep(DELAY_MS)
  }
  
  // Write output
  const output = {
    generated_at: new Date().toISOString(),
    source: 'star-citizen.wiki API',
    count: found,
    resources: loreData
  }
  
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8')
  
  console.log(`\n========================================`)
  console.log(`Lore found: ${found}`)
  console.log(`No lore: ${notFound}`)
  console.log(`Output: ${outputPath}`)
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})
