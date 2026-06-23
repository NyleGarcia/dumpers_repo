#!/usr/bin/env node
/**
 * Diagnose shops with empty inventory in game-shops.json.
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  loadLocalization,
  buildItemCatalog,
  buildInventoryByShopGuid,
  inventoryRowsForShop,
  mapInventoryItem,
} from './lib/shopParseHelpers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const EXTRACTED_DATA = join(PROJECT_ROOT, 'extracted-data')
const gameShops = JSON.parse(readFileSync(join(PROJECT_ROOT, 'src/data/game-shops.json'), 'utf-8'))

const localization = loadLocalization(EXTRACTED_DATA)
const catalog = buildItemCatalog(PROJECT_ROOT)
const inventoriesDir = join(EXTRACTED_DATA, 'Data/Scripts/ShopInventories')
const inventoryByGuid = buildInventoryByShopGuid(inventoriesDir)

const empty = gameShops.shops.filter((s) => !s.inventory?.length)
const shelfEmpty = empty.filter((s) => s.shopInteraction === 'shelf' || s.inventoryExpected === false)
const kioskEmpty = empty.filter((s) => s.inventoryExpected !== false && s.shopInteraction !== 'shelf')
const withInv = gameShops.shops.filter((s) => s.inventory?.length)

console.log('=== Shop inventory summary ===')
console.log(`Total shops: ${gameShops.shops.length}`)
console.log(`With inventory: ${withInv.length}`)
console.log(`Empty (shelf — OK): ${shelfEmpty.length}`)
console.log(`Empty (kiosk — investigate): ${kioskEmpty.length}`)
console.log(`Empty total: ${empty.length}`)

const buckets = {
  noRawInventory: [],
  rawInventoryAllSkipped: [],
  rawInventoryPartialSkipped: [],
  bogusOfflinePath: [],
  duplicateGuidHasInventoryElsewhere: [],
}

const guidToShops = new Map()
for (const shop of gameShops.shops) {
  if (!guidToShops.has(shop.entityGuid)) guidToShops.set(shop.entityGuid, [])
  guidToShops.get(shop.entityGuid).push(shop)
}

for (const shop of empty) {
  if (shop.shopInteraction === 'shelf' || shop.inventoryExpected === false) continue
  const siblings = guidToShops.get(shop.entityGuid) || []
  const siblingWithInv = siblings.find((s) => s.inventory?.length)
  if (siblingWithInv) {
    buckets.duplicateGuidHasInventoryElsewhere.push({ shop, siblingWithInv })
    continue
  }

  const offline = shop.offlineInventoryJson
  const looksLikePath =
    offline &&
    offline.endsWith('.json') &&
    (offline.includes('ShopInventories') || offline.startsWith('Data/') || offline.startsWith('Scripts/'))

  if (offline && !looksLikePath) {
    buckets.bogusOfflinePath.push(shop)
  }

  const rawRows = inventoryRowsForShop(
    { entityGuid: shop.entityGuid, offlineInventoryJson: shop.offlineInventoryJson, label: shop.internalLabel },
    inventoriesDir,
    inventoryByGuid,
    EXTRACTED_DATA,
    {
      location: shop.location,
      site: shop.site,
      system: shop.system,
      socpakPath: shop.socpakPath,
      franchise: shop.franchise,
    }
  )

  const mapped = rawRows.map((r) => mapInventoryItem(r, catalog, localization)).filter(Boolean)

  if (rawRows.length === 0) {
    buckets.noRawInventory.push(shop)
  } else if (mapped.length === 0) {
    buckets.rawInventoryAllSkipped.push({ shop, rawCount: rawRows.length })
  } else if (mapped.length < rawRows.length) {
    buckets.rawInventoryPartialSkipped.push({
      shop,
      rawCount: rawRows.length,
      mappedCount: mapped.length,
    })
  }
}

function printBucket(title, items, formatter) {
  console.log(`\n=== ${title}: ${items.length} ===`)
  for (const item of items.slice(0, 15)) {
    console.log(formatter(item))
  }
  if (items.length > 15) console.log(`  ... and ${items.length - 15} more`)
}

printBucket('Duplicate GUID — another variant has inventory', buckets.duplicateGuidHasInventoryElsewhere, ({ shop, siblingWithInv }) =>
  `  ${shop.name} @ ${shop.location} | same GUID as populated "${siblingWithInv.name}" (${siblingWithInv.inventory.length} items) | socpak: ${shop.socpakPath?.split('/').slice(-2).join('/')}`
)

printBucket('Bogus offlineInventoryJSON token', buckets.bogusOfflinePath, (s) =>
  `  ${s.name} @ ${s.location} | token: ${s.offlineInventoryJson} | guid: ${s.entityGuid.slice(0, 8)}`
)

printBucket('Raw inventory exists but ALL items skipped (display name)', buckets.rawInventoryAllSkipped, ({ shop, rawCount }) =>
  `  ${shop.name} @ ${shop.location} | ${rawCount} raw rows | offline: ${shop.offlineInventoryJson || 'none'} | guid in map: ${inventoryByGuid.has(shop.entityGuid)}`
)

printBucket('Raw inventory partial skip', buckets.rawInventoryPartialSkipped, ({ shop, rawCount, mappedCount }) =>
  `  ${shop.name} @ ${shop.location} | ${mappedCount}/${rawCount} mapped | offline: ${shop.offlineInventoryJson || 'none'}`
)

printBucket('No raw inventory at all (no JSON link)', buckets.noRawInventory, (s) =>
  `  ${s.name} @ ${s.location} (${s.system}) | guid: ${s.entityGuid.slice(0, 8)} | offline: ${s.offlineInventoryJson || 'none'} | label: ${s.internalLabel}`
)

console.log(`\n=== Shelf vendors (empty OK): ${shelfEmpty.length} ===`)
shelfEmpty.slice(0, 10).forEach((s) => console.log(`  ${s.name} @ ${s.location}`))
if (shelfEmpty.length > 10) console.log(`  ... and ${shelfEmpty.length - 10} more`)

const uniqueEmptyGuids = [...new Set(kioskEmpty.map((s) => s.entityGuid))]
console.log(`\n=== Unique kiosk GUIDs still empty: ${uniqueEmptyGuids.length} ===`)
