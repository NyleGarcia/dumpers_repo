import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, basename, dirname } from 'path'
import AdmZip from 'adm-zip'
import { resolveCommodityLabel } from './commodityLocalization.mjs'

/** Socpak label stem -> Inv_* filename stem (same inventory, alternate entity GUID). */
const INV_STEM_ALIASES = [[/^Market_ClothingStand_/i, 'ClothingStand_']]

const INV_LOCATION_TOKENS = {
  levski: ['levski', 'delamar', 'nyx'],
  newbabbage: ['new babbage', 'newbabbage', 'microtech'],
  portolisar: ['port olisar', 'portolisar', 'olisar'],
  grimhex: ['grim hex', 'grimhex', 'yela'],
  area18: ['area 18', 'area18', 'arccorp'],
  lorville: ['lorville', 'hurston'],
  orison: ['orison', 'crusader'],
  pyro: ['pyro'],
  reststop: ['rest stop', 'reststop', 'rest_stop'],
}

/** Generic outpost placeholder — not a real shop stock list. */
const PLACEHOLDER_INVENTORY_RE = /Temp_Outpost_ShopInventory/i

/** Food carts / bar terminals with dedicated Inv_* kiosk listings. */
const KIOSK_FOOD_LABEL_PATTERNS = [
  /_cart_/i,
  /(?:Burrito|HotDog|Noodle|Pizza|Juice)Bar_.*Food_RestStop/i,
  /^SCShop_burrito_/i,
  /^SCShop_hotdog_/i,
  /^SCShop_noodle_/i,
  /^SCShop_pizza_/i,
]

/** Shelf / direct-buy vendors — no browseable terminal inventory in game files. */
const SHELF_SHOP_LABEL_PATTERNS = [
  /^SCShop_Whammers/i,
  /^SCShop_Ellroys/i,
  /^SCShop_XS_/i,
  /^SCShop_NearBeer/i,
  /^SCShop_Coffee_to_Go/i,
  /^SCShop_HatStall/i,
  /^SCShop_S_Harvestable/i,
  /^SCShop_CousinCrows_/i,
  /^SCShop_CrusaderShowroom_/i,
  /^SCShop_Makau_/i,
  /^SCShop_Orison_Covalex/i,
  /^SCShop_ProvidenceSurplus_/i,
  /^SCShop_Cargo_Office/i,
  /^SCShop_Orison_KelTo/i,
  /^SCShop_FactoryLine_/i,
  /^SCShop_Bar_UtilStation_/i,
]

const FRANCHISE_DISPLAY = {
  dumpersdepot: "Dumper's Depot",
  newdeal: 'New Deal',
  astroarmada: 'Astro Armada',
  casaba: 'Casaba Outlet',
  cubbyblast: 'Cubby Blast',
  livefire: 'Live Fire Weapons',
  whamm: 'Whamm',
  cordrys: 'Cordry',
  consobjects: 'Conscientious Objects',
  conscientiousobjects: 'Conscientious Objects',
  teach: "Teach's Ship Shop",
  regalluxuryrentals: 'Regal Luxury Rentals',
  hurstondynamics: 'Hurston Dynamics',
  microtech: 'microTech',
  garritydefense: 'Garrity Defense',
  centermass: 'CenterMass',
  ftl: 'FTL',
  redwind: 'Red Wind Linehaul',
}

const SHOP_LABEL_PATTERNS = [
  { re: /refinery.*store/i, name: 'Refinery Shop' },
  { re: /refinery.*ore/i, name: 'Refinery Ore Sales' },
  { re: /commodity/i, name: 'Commodity Terminal' },
  { re: /dumpers.?depot/i, name: "Dumper's Depot" },
  { re: /mining/i, name: 'Mining Equipment' },
  { re: /conscientious|consobjects/i, name: 'Conscientious Objects' },
  { re: /personalweapon|weapon|ammo|livefire|centermass/i, name: 'Weapons & Ammo' },
  { re: /clothing/i, name: 'Clothing Shop' },
  { re: /food|bar|cafe|restaurant/i, name: 'Food & Drink' },
]

const LOCATION_HINTS = [
  { re: /area18|area_18|a18/, system: 'Stanton', site: 'ArcCorp', location: 'Area 18', locationType: 'city' },
  { re: /lorville|l19/, system: 'Stanton', site: 'Hurston', location: 'Lorville', locationType: 'city' },
  { re: /newbabbage|nb_|new_babbage/, system: 'Stanton', site: 'microTech', location: 'New Babbage', locationType: 'city' },
  { re: /orison|orv_|crusader(?!.*l[1-5])/, system: 'Stanton', site: 'Crusader', location: 'Orison', locationType: 'city' },
  { re: /levski|refin_levski|nyx/, system: 'Nyx', site: 'Delamar', location: 'Levski', locationType: 'city' },
  { re: /grimhex|grim_hex/, system: 'Stanton', site: 'Yela', location: 'Grim HEX', locationType: 'rest_stop' },
  { re: /portolisar|olisar|po_|port_olisar/, system: 'Stanton', site: 'Stanton', location: 'Port Olisar', locationType: 'rest_stop' },
  { re: /cru[-_]?l1|crusader.*l1/, system: 'Stanton', site: 'Crusader', location: 'CRU-L1', locationType: 'refinery' },
  { re: /hur[-_]?l1|hurston.*l1/, system: 'Stanton', site: 'Hurston', location: 'HUR-L1', locationType: 'refinery' },
  { re: /mic[-_]?l1|microtech.*l1/, system: 'Stanton', site: 'microTech', location: 'MIC-L1', locationType: 'refinery' },
  { re: /arc[-_]?l1|arccorp.*l1/, system: 'Stanton', site: 'ArcCorp', location: 'ARC-L1', locationType: 'refinery' },
  { re: /pyro/, system: 'Pyro', site: 'Pyro', location: 'Pyro', locationType: 'unknown' },
  { re: /reststop|rs_ext|rs_int/, system: 'Stanton', site: null, location: null, locationType: 'rest_stop' },
]

function inferSiteFromPath(lower) {
  if (/levski|delamar|nyx/.test(lower)) return 'Delamar'
  if (/lorville|l19|hurston|hur_|_hur-|\/hur\//.test(lower)) return 'Hurston'
  if (/newbabbage|nb_|microtech|mic_|_mic-|\/mic\//.test(lower)) return 'microTech'
  if (/orison|orv_|crusader|cru_|_cru-|\/cru\//.test(lower)) return 'Crusader'
  if (/area18|a18|arccorp|arc_|_arc-|\/arc\//.test(lower)) return 'ArcCorp'
  if (/yela|grimhex|grim_hex/.test(lower)) return 'Yela'
  if (/portolisar|olisar|po_|port_olisar/.test(lower)) return 'Crusader'
  if (/pyro/.test(lower)) return 'Pyro'
  return null
}

function resolveHierarchySite(hint, lower) {
  if (hint.site) return hint.site
  const inferred = inferSiteFromPath(lower)
  if (inferred) return inferred
  if (hint.locationType === 'rest_stop') return 'Rest Stops'
  if (hint.locationType === 'refinery') return 'Refineries'
  return hint.system
}

export function readSocpakEntries(socpakPath) {
  const zip = new AdmZip(socpakPath)
  const entries = zip.getEntries()
  const result = { xml: null, soc: null, xmlName: null, socName: null }

  for (const entry of entries) {
    if (entry.isDirectory) continue
    const name = entry.entryName.replace(/\\/g, '/')
    if (!result.xml && name.endsWith('.xml') && !name.includes('/metadata/') && !name.endsWith('_editor.xml')) {
      result.xml = entry.getData().toString('utf8')
      result.xmlName = name
    }
    if (!result.soc && name.endsWith('.soc')) {
      result.soc = entry.getData()
      result.socName = name
    }
  }

  return result
}

export function parseContainerShops(xml) {
  if (!xml) return []
  const shops = []
  const entityRe = /<Entity\s+guid="([^"]+)"\s+label="([^"]+)"/g
  let match
  while ((match = entityRe.exec(xml)) !== null) {
    const [, guid, label] = match
    if (label.startsWith('SCShop_') || label.includes('SCShop')) {
      shops.push({ entityGuid: guid.toLowerCase(), label })
    }
  }
  return shops
}

function isValidInventoryJsonPath(token) {
  if (!token || typeof token !== 'string') return false
  return (
    token.endsWith('.json') &&
    (token.includes('ShopInventories') || token.startsWith('Data/') || token.startsWith('Scripts/'))
  )
}

function resolveInventoryJsonPath(raw, extractedDataRoot) {
  if (!isValidInventoryJsonPath(raw)) return null

  const normalized = raw.replace(/\\/g, '/')
  const candidates = [
    join(extractedDataRoot, normalized),
    join(extractedDataRoot, 'Data', normalized.replace(/^Data\//, '')),
    join(extractedDataRoot, 'Data', normalized.replace(/^Scripts\//, 'Scripts/')),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return null
}

export function parseSocItemShops(socBuffer) {
  if (!socBuffer) return []
  const str = socBuffer.toString('latin1')
  const tokens = str.split('\u0000').filter((t) => t.length > 0)
  const shops = []

  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].startsWith('SCShop_')) continue

    const label = tokens[i]
    const block = {
      label,
      entityGuid: null,
      shopInventoryType: null,
      offlineInventoryJson: null,
    }

    for (let j = i + 1; j < Math.min(i + 50, tokens.length); j++) {
      if (j > i + 1 && tokens[j].startsWith('SCShop_')) break

      if (tokens[j] === 'shopInventoryType' && tokens[j + 1]) {
        block.shopInventoryType = tokens[j + 1]
      }
      if (tokens[j] === 'offlineInventoryJSON') {
        for (let k = j + 1; k < Math.min(j + 8, tokens.length); k++) {
          if (isValidInventoryJsonPath(tokens[k])) {
            block.offlineInventoryJson = tokens[k].replace(/\\/g, '/')
            break
          }
        }
      }
      if (tokens[j] === 'SCShop' && tokens[j + 2]) {
        block.entityGuid = tokens[j + 2].toLowerCase()
      }
    }

    if (block.shopInventoryType === 'ITEM' && block.entityGuid) {
      shops.push(block)
    }
  }

  return shops
}

export function mergeShopRecords(xmlShops, socShops) {
  const byGuid = new Map()

  for (const shop of socShops) {
    byGuid.set(shop.entityGuid, { ...shop })
  }

  for (const shop of xmlShops) {
    const existing = byGuid.get(shop.entityGuid) || {}
    byGuid.set(shop.entityGuid, {
      ...existing,
      entityGuid: shop.entityGuid,
      label: shop.label || existing.label,
      shopInventoryType: existing.shopInventoryType || 'ITEM',
      offlineInventoryJson: existing.offlineInventoryJson || null,
    })
  }

  return [...byGuid.values()]
}

export function deriveHierarchy(socpakRelativePath) {
  const lower = socpakRelativePath.replace(/\\/g, '/').toLowerCase()
  const fileName = basename(lower, '.socpak')

  let shopCategory = 'unknown'
  let franchise = null

  const shopsMatch = lower.match(/\/shops\/([^/]+)\/([^/]+)\//)
  if (shopsMatch) {
    shopCategory = shopsMatch[1]
    franchise = shopsMatch[2]
  }

  for (const hint of LOCATION_HINTS) {
    if (hint.re.test(lower) || hint.re.test(fileName)) {
      const site = resolveHierarchySite(hint, lower)
      return {
        system: hint.system,
        site,
        location: hint.location || titleCase(fileName.replace(/_/g, ' ')),
        locationType: hint.locationType,
        shopCategory,
        franchise,
      }
    }
  }

  const inferredSite = inferSiteFromPath(lower)
  return {
    system: lower.includes('pyro') ? 'Pyro' : lower.includes('nyx') ? 'Nyx' : 'Stanton',
    site: inferredSite || 'Rest Stops',
    location: titleCase(fileName.replace(/_/g, ' ')),
    locationType: lower.includes('refin') ? 'refinery' : 'unknown',
    shopCategory,
    franchise,
  }
}

export function resolveShopDisplayName(label, franchise, _location) {
  for (const { re, name } of SHOP_LABEL_PATTERNS) {
    if (re.test(label)) return name
  }

  if (franchise && FRANCHISE_DISPLAY[franchise]) {
    return FRANCHISE_DISPLAY[franchise]
  }

  const cleaned = label
    .replace(/^SCShop_/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()

  if (/^[A-Z0-9\s-]+$/.test(cleaned) && cleaned.length > 3) {
    return titleCase(cleaned)
  }

  return franchise && FRANCHISE_DISPLAY[franchise]
    ? FRANCHISE_DISPLAY[franchise]
    : titleCase(cleaned) || 'Shop'
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function loadLocalization(extractedDataRoot) {
  const globalIniPath = join(extractedDataRoot, 'Data/Localization/english/global.ini')
  if (!existsSync(globalIniPath)) return {}

  const localization = {}
  const content = readFileSync(globalIniPath, 'utf-8')
  for (const line of content.split('\n')) {
    if (!line.includes('=')) continue
    const eqIndex = line.indexOf('=')
    const key = line.substring(0, eqIndex).trim()
    const value = line.substring(eqIndex + 1).trim()
    localization[key] = value
    if (key.includes(',')) {
      const baseKey = key.split(',')[0]
      if (!localization[baseKey]) localization[baseKey] = value
    }
  }
  return localization
}

export function resolveLocalization(key, localization) {
  if (!key) return null
  const lookupKey = key.startsWith('@') ? key.substring(1) : key
  if (localization[lookupKey]) return localization[lookupKey]
  if (key.startsWith('@')) return null
  return key
}

export function isPlaceholderInventoryPath(path) {
  return Boolean(path && PLACEHOLDER_INVENTORY_RE.test(path))
}

export function resolveShopInteraction(label, franchise, offlineInventoryJson) {
  if (KIOSK_FOOD_LABEL_PATTERNS.some((re) => re.test(label))) {
    return { shopInteraction: 'kiosk', inventoryExpected: true }
  }

  if (
    SHELF_SHOP_LABEL_PATTERNS.some((re) => re.test(label)) ||
    franchise === 'whamm' ||
    /^SCShop_Ellroys/i.test(label)
  ) {
    return { shopInteraction: 'shelf', inventoryExpected: false }
  }

  if (isPlaceholderInventoryPath(offlineInventoryJson)) {
    return { shopInteraction: 'shelf', inventoryExpected: false }
  }

  return { shopInteraction: 'kiosk', inventoryExpected: true }
}

export function buildItemCatalog(projectRoot) {
  const byId = new Map()

  const componentsPath = join(projectRoot, 'src/data/game-components.json')
  if (existsSync(componentsPath)) {
    const data = JSON.parse(readFileSync(componentsPath, 'utf-8'))
    for (const item of data.components || []) {
      if (item.id) {
        byId.set(item.id.toLowerCase(), {
          displayName: item.displayName,
          itemType: item.type,
          recordName: item.name,
        })
      }
    }
  }

  const recordsRoot = join(projectRoot, 'extracted-data/libs/foundry/records')
  if (existsSync(recordsRoot)) {
    walkJsonFiles(recordsRoot, (filePath) => {
      try {
        const json = JSON.parse(readFileSync(filePath, 'utf-8'))
        const id = json._RecordId_?.toLowerCase?.()
        if (!id || byId.has(id)) return

        const components = json._RecordValue_?.Components || []
        const attach = components.find((c) => c._Type_ === 'SAttachableComponentParams')
        const commodity = components.find((c) => c._Type_ === 'CommodityComponentParams')
        const purchasable = components.find((c) => c._Type_ === 'SCItemPurchasableParams')
        const recordName = json._RecordName_?.replace(/^EntityClassDefinition\./, '')

        if (attach) {
          byId.set(id, {
            displayName: null,
            itemType: attach.AttachDef?.Type || null,
            recordName: recordName || null,
            locKey: attach.AttachDef?.Localization?.Name || null,
          })
          return
        }

        if (commodity || purchasable) {
          const rawLocKey = commodity?.name || purchasable?.displayName || purchasable?.displayType
          byId.set(id, {
            displayName: null,
            itemType: 'Commodity',
            recordName: recordName || null,
            locKey: rawLocKey?.startsWith('@') ? rawLocKey.slice(1) : rawLocKey || null,
          })
        }
      } catch {
        // skip invalid json
      }
    })
  }

  return byId
}

function walkJsonFiles(dir, callback) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkJsonFiles(full, callback)
    else if (entry.name.endsWith('.json')) callback(full)
  }
}

export function resolveItemDisplay(itemId, catalog, localization) {
  const entry = catalog.get(itemId.toLowerCase())
  if (!entry) return null

  if (entry.displayName && !entry.displayName.startsWith('@')) {
    return {
      displayName: entry.displayName,
      itemType: entry.itemType,
      recordName: entry.recordName,
    }
  }

  if (entry.locKey) {
    const resolved = resolveLocalization(entry.locKey, localization)
    if (resolved && !resolved.startsWith('@') && resolved !== '@LOC_UNINITIALIZED') {
      return {
        displayName: resolved,
        itemType: entry.itemType,
        recordName: entry.recordName,
      }
    }
  }

  if (entry.itemType === 'Commodity' && entry.recordName) {
    const label = resolveCommodityLabel(entry.recordName, localization)
    if (label) {
      return {
        displayName: label,
        itemType: entry.itemType,
        recordName: entry.recordName,
      }
    }
  }

  return null
}

function normalizeMatchText(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function inventoryStemFromLabel(label) {
  let stem = label.replace(/^SCShop_/i, '')
  for (const [re, replace] of INV_STEM_ALIASES) {
    if (re.test(stem)) stem = stem.replace(re, replace)
  }
  return stem
}

function inventoryLocationMatches(stem, context) {
  const normalizedStem = stem.toLowerCase()
  const haystack = normalizeMatchText(
    [context.location, context.site, context.system, context.socpakPath].filter(Boolean).join(' ')
  )

  for (const [token, hints] of Object.entries(INV_LOCATION_TOKENS)) {
    if (!normalizedStem.includes(`_${token}`) && !normalizedStem.endsWith(token)) continue
    if (token === 'reststop') return true
    return hints.some((hint) => haystack.includes(hint.replace(/[^a-z0-9]+/g, ' ').trim()))
  }

  return true
}

function readInventoryJsonFile(filePath) {
  try {
    const json = JSON.parse(readFileSync(filePath, 'utf-8'))
    return json.Collection?.Inventory || []
  } catch {
    return null
  }
}

export function inventoryRowsForShop(shop, inventoriesDir, inventoryByGuid, extractedDataRoot, context = {}) {
  const { shopInteraction, inventoryExpected } = resolveShopInteraction(
    shop.label || '',
    context.franchise || null,
    shop.offlineInventoryJson
  )

  if (shopInteraction === 'shelf' || !inventoryExpected) {
    return []
  }

  let inventory = []

  if (shop.offlineInventoryJson && !isPlaceholderInventoryPath(shop.offlineInventoryJson)) {
    const jsonPath = resolveInventoryJsonPath(shop.offlineInventoryJson, extractedDataRoot)
    if (jsonPath) {
      inventory = readInventoryJsonFile(jsonPath) || []
    }
  }

  if (inventory.length === 0 && inventoryByGuid.has(shop.entityGuid)) {
    inventory = inventoryByGuid.get(shop.entityGuid)[0]?.inventory || []
  }

  if (inventory.length === 0 && shop.label) {
    const stem = inventoryStemFromLabel(shop.label)
    if (inventoryLocationMatches(stem, context)) {
      const jsonPath = join(inventoriesDir, `Inv_${stem}.json`)
      if (existsSync(jsonPath)) {
        inventory = readInventoryJsonFile(jsonPath) || []
      }
    }
  }

  return inventory
}

export function buildInventoryByShopGuid(inventoriesDir) {
  const byGuid = new Map()
  if (!existsSync(inventoriesDir)) return byGuid

  for (const file of readdirSync(inventoriesDir).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(readFileSync(join(inventoriesDir, file), 'utf-8'))
    const shopIds = (json.ShopID || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    for (const guid of shopIds) {
      if (!byGuid.has(guid)) byGuid.set(guid, [])
      byGuid.get(guid).push({ file, inventory: json.Collection?.Inventory || [] })
    }
  }

  return byGuid
}

export function mapInventoryItem(row, catalog, localization) {
  const itemId = row.ID?.ID?.[0]
  if (!itemId) return null

  const resolved = resolveItemDisplay(itemId, catalog, localization)
  if (!resolved?.displayName) return null

  const buyPrice = row.BuyPrice > 0 ? Math.round(row.BuyPrice) : null
  const sellPrice = row.SellPrice > 0 ? Math.round(row.SellPrice) : null
  const price = buyPrice ?? sellPrice ?? null

  return {
    itemName: itemId,
    displayName: resolved.displayName,
    itemType: resolved.itemType,
    recordName: resolved.recordName,
    basePrice: price ?? 0,
    effectivePrice: price,
    shopSells: buyPrice != null,
    shopBuys: sellPrice != null,
    shopRents: false,
    priceKnown: price != null,
  }
}

export function listSocpakFiles(rootDir) {
  const results = []
  function walk(dir) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.socpak')) results.push(full)
    }
  }
  walk(rootDir)
  return results
}

export function readGameBuild(extractedDataRoot) {
  const buildFile = join(extractedDataRoot, 'game-build.json')
  if (!existsSync(buildFile)) return null
  try {
    const data = JSON.parse(readFileSync(buildFile, 'utf-8'))
    return data.version || null
  } catch {
    return null
  }
}
