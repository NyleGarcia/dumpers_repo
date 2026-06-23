#!/usr/bin/env node
/**
 * Parse shop socpaks + game ShopInventories JSON into src/data/game-shops.json.
 *
 * Run after extracting shop socpaks and ShopInventories JSON via extract-game-data.ps1
 *
 * Prices are included when present in ShopInventories JSON; otherwise left null/0.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import {
  readSocpakEntries,
  parseContainerShops,
  parseSocItemShops,
  mergeShopRecords,
  deriveHierarchy,
  resolveShopDisplayName,
  loadLocalization,
  buildItemCatalog,
  buildInventoryByShopGuid,
  inventoryRowsForShop,
  mapInventoryItem,
  listSocpakFiles,
  readGameBuild,
  resolveShopInteraction,
} from './lib/shopParseHelpers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const EXTRACTED_DATA = join(PROJECT_ROOT, 'extracted-data')
const OUTPUT_PATH = join(PROJECT_ROOT, 'src', 'data', 'game-shops.json')
const META_OUTPUT_PATH = join(PROJECT_ROOT, 'src', 'data', 'game-shops-meta.json')
const SYNC_OUTPUT_PATH = join(PROJECT_ROOT, 'supabase', 'functions', 'sync-shop-data', 'game-shops.json')

const SOCPAK_ROOTS = [
  join(EXTRACTED_DATA, 'Data/ObjectContainers/PU/Shops'),
  join(EXTRACTED_DATA, 'Data/ObjectContainers/PU/loc/mod'),
]

const stats = {
  socpaksScanned: 0,
  shopsFound: 0,
  shopsWithInventory: 0,
  shelfShops: 0,
  emptyKioskShops: 0,
  inventoryItems: 0,
  itemsWithPrice: 0,
  itemsSkippedNoDisplayName: 0,
  errors: [],
}

function main() {
  console.log('Parsing shop socpaks from game files...\n')

  const localization = loadLocalization(EXTRACTED_DATA)
  const catalog = buildItemCatalog(PROJECT_ROOT)
  const inventoriesDir = join(EXTRACTED_DATA, 'Data/Scripts/ShopInventories')
  const inventoryByGuid = buildInventoryByShopGuid(inventoriesDir)
  const gameBuild = readGameBuild(EXTRACTED_DATA)

  const shops = []
  const seenReferences = new Set()

  for (const root of SOCPAK_ROOTS) {
    if (!existsSync(root)) {
      console.warn(`  Skipping missing path: ${relative(PROJECT_ROOT, root)}`)
      continue
    }

    const socpakFiles = listSocpakFiles(root).filter((p) => {
      const lower = p.toLowerCase()
      if (root.includes('loc/mod') && !lower.includes('reststop')) return false
      return true
    })

    console.log(`  Scanning ${socpakFiles.length} socpaks in ${relative(PROJECT_ROOT, root)}`)

    for (const socpakPath of socpakFiles) {
      stats.socpaksScanned++
      try {
        const socpakRelative = relative(EXTRACTED_DATA, socpakPath).replace(/\\/g, '/')
        const { xml, soc } = readSocpakEntries(socpakPath)
        const xmlShops = parseContainerShops(xml)
        const socShops = parseSocItemShops(soc)
        const merged = mergeShopRecords(xmlShops, socShops)

        if (merged.length === 0) continue

        const hierarchy = deriveHierarchy(socpakRelative)

        for (const shop of merged) {
          const shopReference = `socpak:${socpakRelative}:${shop.entityGuid}`
          if (seenReferences.has(shopReference)) continue
          seenReferences.add(shopReference)

          const name = resolveShopDisplayName(shop.label, hierarchy.franchise, hierarchy.location)
          const { shopInteraction, inventoryExpected } = resolveShopInteraction(
            shop.label,
            hierarchy.franchise,
            shop.offlineInventoryJson
          )
          const rawInventory = inventoryRowsForShop(
            shop,
            inventoriesDir,
            inventoryByGuid,
            EXTRACTED_DATA,
            {
              location: hierarchy.location,
              site: hierarchy.site,
              system: hierarchy.system,
              socpakPath: socpakRelative,
              franchise: hierarchy.franchise,
            }
          )

          const inventory = []
          for (const row of rawInventory) {
            const mapped = mapInventoryItem(row, catalog, localization)
            if (!mapped) {
              stats.itemsSkippedNoDisplayName++
              continue
            }
            inventory.push(mapped)
            stats.inventoryItems++
            if (mapped.priceKnown) stats.itemsWithPrice++
          }

          if (inventory.length > 0) stats.shopsWithInventory++
          if (shopInteraction === 'shelf') stats.shelfShops++
          else if (inventory.length === 0) stats.emptyKioskShops++

          shops.push({
            shopReference,
            name,
            socpakPath: socpakRelative,
            entityGuid: shop.entityGuid,
            internalLabel: shop.label,
            system: hierarchy.system,
            site: hierarchy.site,
            location: hierarchy.location,
            locationType: hierarchy.locationType,
            shopCategory: hierarchy.shopCategory,
            franchise: hierarchy.franchise,
            shopKind: 'item',
            shopInteraction,
            inventoryExpected,
            offlineInventoryJson: shop.offlineInventoryJson || null,
            inventory,
          })
          stats.shopsFound++
        }
      } catch (err) {
        stats.errors.push(`${socpakPath}: ${err.message}`)
      }
    }
  }

  shops.sort((a, b) => {
    if (a.system !== b.system) return a.system.localeCompare(b.system)
    if (a.site !== b.site) return (a.site || '').localeCompare(b.site || '')
    if (a.location !== b.location) return (a.location || '').localeCompare(b.location || '')
    return a.name.localeCompare(b.name)
  })

  const output = {
    _source: 'Star Citizen game files (socpak + ShopInventories)',
    _parsed: new Date().toISOString(),
    gameBuild,
    stats: {
      socpaksScanned: stats.socpaksScanned,
      shops: stats.shopsFound,
      shopsWithInventory: stats.shopsWithInventory,
      shelfShops: stats.shelfShops,
      emptyKioskShops: stats.emptyKioskShops,
      inventoryItems: stats.inventoryItems,
      itemsWithPrice: stats.itemsWithPrice,
      itemsSkippedNoDisplayName: stats.itemsSkippedNoDisplayName,
      parseErrors: stats.errors.length,
    },
    shops,
  }

  const emptyShops = shops.filter((s) => s.inventory.length === 0).length

  const meta = {
    _parsed: output._parsed,
    gameBuild: output.gameBuild,
    socpaksScanned: stats.socpaksScanned,
    shops: stats.shopsFound,
    shopsWithInventory: stats.shopsWithInventory,
    shelfShops: stats.shelfShops,
    emptyKioskShops: stats.emptyKioskShops,
    emptyShops,
    inventoryItems: stats.inventoryItems,
    itemsWithPrice: stats.itemsWithPrice,
    itemsSkippedNoDisplayName: stats.itemsSkippedNoDisplayName,
    parseErrors: stats.errors.length,
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  writeFileSync(META_OUTPUT_PATH, JSON.stringify(meta, null, 2))
  writeFileSync(SYNC_OUTPUT_PATH, JSON.stringify(output, null, 2))

  console.log('\n✓ Shop parse complete')
  console.log(`  Socpaks scanned:     ${stats.socpaksScanned}`)
  console.log(`  Shops found:         ${stats.shopsFound}`)
  console.log(`  With inventory:      ${stats.shopsWithInventory}`)
  console.log(`  Shelf vendors:       ${stats.shelfShops} (no kiosk listing expected)`)
  console.log(`  Empty kiosks:        ${stats.emptyKioskShops} (inventory TBD)`)
  console.log(`  Inventory items:     ${stats.inventoryItems}`)
  console.log(`  Items with price:    ${stats.itemsWithPrice}`)
  console.log(`  Skipped (no name):   ${stats.itemsSkippedNoDisplayName}`)
  if (stats.errors.length > 0) {
    console.log(`  Parse errors:        ${stats.errors.length}`)
    stats.errors.slice(0, 5).forEach((e) => console.warn(`    - ${e}`))
  }
  console.log(`\n  Output: ${relative(PROJECT_ROOT, OUTPUT_PATH)}`)
}

main()
