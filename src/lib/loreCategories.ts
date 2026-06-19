import { getResourceType } from '../config/resourceTypes'

/** Minimum entries before a category is shown on its own. Smaller groups roll into Miscellaneous. */
export const LORE_MIN_CATEGORY_SIZE = 2

export const COMMODITY_LORE_CATEGORY_ORDER = [
  'Ores & Minerals',
  'Refined Materials',
  'Gems & Hand Mineables',
  'Gases',
  'Contraband',
  'Trade Goods',
  'Medical',
  'Industrial',
  'Other',
] as const

export const ITEM_LORE_CATEGORY_ORDER = [
  'Ships & Flyable',
  'Ship Paints & Liveries',
  'Ordnance & Missiles',
  'Ship Weapons & Turrets',
  'Ship Modules & Systems',
  'FPS Weapons',
  'Optics & Attachments',
  'Armor & Clothing',
  'Character Customization',
  'Food & Drink',
  'Wildlife',
  'Flair & Collectibles',
  'Salvage & Industrial',
  'Ground Vehicles',
  'Gadgets & Tools',
  'Consumables',
  'Miscellaneous',
] as const

const SHIP_COMPONENTS = 'Ship Modules & Systems' as const

export const LORE_CATEGORY_ORDER = [
  ...COMMODITY_LORE_CATEGORY_ORDER,
  ...ITEM_LORE_CATEGORY_ORDER,
] as const

const SHIP_COMPONENT_CODES: Record<string, (typeof ITEM_LORE_CATEGORY_ORDER)[number]> = {
  shld: SHIP_COMPONENTS,
  cool: SHIP_COMPONENTS,
  powr: SHIP_COMPONENTS,
  qdrv: SHIP_COMPONENTS,
  radr: SHIP_COMPONENTS,
  life: SHIP_COMPONENTS,
  wepn: 'Ship Weapons & Turrets',
  comp: SHIP_COMPONENTS,
  jump: SHIP_COMPONENTS,
  qint: SHIP_COMPONENTS,
  qsnk: SHIP_COMPONENTS,
}

const ARMOR_STEM_KEYWORDS = [
  'armor',
  'flightsuit',
  'helmet',
  'shirt',
  'jacket',
  'pants',
  'gloves',
  'boots',
  'undersuit',
  'monocle',
  'tophat',
  'hat_',
  '_hat',
  'bandana',
  'mask',
  'vest',
  'coat',
  'outfit',
  'bodysuit',
  'backpack',
]

const FPS_WEAPON_KEYWORDS = [
  'pistol',
  'rifle',
  'shotgun',
  'sniper',
  'smg',
  'lmg',
  'hmg',
  'scattergun',
  'knife',
  'sword',
]

const FLAIR_LABEL_PATTERN =
  /\b(plushie|poster|trophy|display|bobblehead|fish tank|fishtank|banner|holiday tree|holiday wreath|tankard|replica|figurine|coin|sculpture|hologram|artifact fragment|lockbox replica|container model|bar hologram|jet \(|\bchess\b|painting|statue|holographic flag|\bmug\b|\blamp\b|basketball|insulated cup|gift box|\bskull\b)\b/i

const ORDNANCE_LABEL_PATTERN =
  /\b(missile rack|bomb rack|missile|torpedo|torp\b|warhead|ordnance|rocket\b|countermeasure|chaff launcher|flare launcher|decoy launcher|noise launcher|ammobox|ammo box|decoy ammo|ship ammunition|flares\b|noise\b|platform\b|pulse slug|ammunition\b|\d+mm\b|\bps-\d+\b|\bgauss\b|\bpc-ff\b|quikflare)\b/i

const ARMOR_SUIT_STEM_PREFIXES = new Set([
  'qrt',
  'clda',
  'vgl',
  'cds',
  'kap',
  'omc',
  'cba',
  'hrst',
  'vncl',
  'cnie',
  'gmni',
  'rrs',
  'rsi',
  'scu',
  'nvy',
  'fio',
  'hwk',
  'thp',
  'adv',
])

const CLOTHING_STEM_PREFIXES = new Set(['cba', 'scu', 'nvy', 'fio', 'hwk', 'rmb', 'dyl', 'roo'])

const SHIP_COMPONENT_STEM_PREFIXES = new Set([
  'qdmp',
  'qrdv',
  'qed',
  'jdrv',
  'hypr',
  'okbv',
  'arco',
  'lfsp',
  'storall',
])

const SHIP_COMPONENT_LABEL_PATTERN =
  /\b(quantum drive|jump drive|thruster|retro thruster|mav thruster|main engine|main thruster|twin main|hammer propulsion|origin jump|cooler|shield|soloshield|power plant|powerbolt|radar|life support|quantum enforcement|qed\b|\bqd\b|fuel intake|fuel tank|landing system|ejection seat|copilot seat|pilot seat|emp generator|tractor beam|computer|sensor suite|wing mount|mount cap)\b/i

const WILDLIFE_STEMS = new Set([
  'alienfish',
  'stripedfish',
  'goldfish',
  'smallfish',
  'cleanerfish',
  'torshucrab',
  'crab',
  'jellyfish',
])

const ARMOR_PIECE_STEM_PATTERN =
  /_(combat|env|explorer|specialist|utility)_(heavy|light|medium).*(arms|core|legs|suit|helmet)/i

const SHIP_WEAPON_STEM_PATTERN =
  /(ballisticgatling|laserrepeater|bombrack|missilelauncher|ballisticcannon|lasercannon|_pdc_|executioner|dominator_platform|stalker_platform|_gimbal_)/i

const FPS_WEAPON_STEM_PATTERN = /(glauncher_|apar_special)/i

const COMMODITY_TYPE_CATEGORIES: Record<string, string> = {
  type_food: 'Food & Drink',
  type_drink: 'Food & Drink',
  type_gas: 'Gases',
  type_mineral: 'Ores & Minerals',
  type_metal: 'Ores & Minerals',
  type_nonmetals: 'Ores & Minerals',
  type_natural: 'Trade Goods',
  type_scrap: 'Industrial',
  type_waste: 'Industrial',
  type_medicalsupply: 'Medical',
  type_vice: 'Contraband',
  type_militarysupply: 'Trade Goods',
  type_consumergoods: 'Trade Goods',
  type_processedgoods: 'Trade Goods',
  type_manmade: 'Industrial',
  type_alloy: 'Refined Materials',
  type_hpmc: 'Refined Materials',
}

const COMMODITY_FOOD_KEYS = new Set([
  'type_food',
  'type_drink',
  'fresh_food',
  'processed_food',
  'human_food_bars',
  'distilled_spirits',
  'bluebilva',
  'blue_bilva',
  'jumpinglimes',
  'jumping_limes',
  'golden_medmon',
  'sunset_berries',
  'spiral',
  'lunes',
  'oza',
  'pitambu',
  'decari_pod',
  'wuotanseed',
  'amiantpod',
  'degnous_root',
  'prota',
  'gasping_weevil_eggs',
])

const COMMODITY_TRADE_KEYS = new Set([
  'agriculturalgoods',
  'agriculturalsupplies',
  'agricultural_supplies',
  'organimass',
  'pingala',
  'ck13_gid_seed_blend',
  'flareweedstalk',
  'fotiascrub',
  'nereus',
  'heart_of_the_woods',
  'revenant_pod',
  'altruciatoxin_unprocessed',
  'osoian_hides',
  'ventfilters',
  'ventslug',
  'moldsamples',
  'moldtreatment',
  'audio_visual_equipment',
  'consumergoods',
  'militarysupplies',
  'mobyglass',
  'hlx99hyperprocessors',
  'rs1odyseyspacesuits',
  'redfinenergymodulator',
  'stonebugshell',
  'sulfermoss',
  'ranta_dung',
  'quasigrazeregg',
  'quasigrazertongue',
  'valakkarfang',
  'valakkarfang_irradiated',
  'valakkarhide_irradiated',
  'valakkarpearl_irradiated',
  'yormandi_tongue',
  'detatrine',
  'dymantium',
  'apoxygenite',
  'marok_gem',
])

const COMMODITY_ORDNANCE_KEYS = new Set([
  'countermeasures_decoy',
  'countermeasures_noise',
])

const COMMODITY_FLAIR_KEYS = new Set(['souvenirs', 'fireworks', 'partyfavors', 'special_holidaybox'])

const COMMODITY_MEDICAL_KEYS = new Set([
  'medpens',
  'oxypens',
  'medgel',
  'lifecure_medsticks',
  'medical_supplies',
  'kopionhorn',
  'kopionhorn_irradiated',
])

const COMMODITY_REFINED_KEYS = new Set([
  'diamond',
  'silnex',
  'neograph',
  'thermalfoam',
  'steel',
  'diluthermex',
  'dynaflex',
  'elespo',
  'lastaprene',
  'lycara',
  'omnapoxy',
  'sarilus',
  'zeta_prolanide',
  'acryliplex',
  'bioplastic',
  'cadmiumallinide',
  'diamond_laminate',
  'carbonsilk',
  'carinite_pure',
])

const HARVESTABLE_FOOD_DESCRIPTION =
  /\bNDR:\s*\d+|\bHEI:\s*\d+|\bEffects:\s*(Hydrating|Energizing|Dehydrating)/i

function normalizeCommodityKey(resourceKey: string): string {
  const aliases: Record<string, string> = {
    bluebilva: 'blue_bilva',
    jumpinglimes: 'jumping_limes',
    agriculturalsupplies: 'agricultural_supplies',
    agriculturalgoods: 'agricultural_supplies',
    partyfavors: 'party_favors',
    redfinenergymodulator: 'redfin_energy_modulators',
    moldsamples: 'molina_mold_samples',
    moldtreatment: 'molina_mold_treatment',
    ventfilters: 'molina_ventilation_filters',
    kopionhorn: 'kopion_horn',
    kopionhorn_irradiated: 'irradiated_kopion_horn',
  }
  return aliases[resourceKey.toLowerCase()] ?? resourceKey.toLowerCase()
}

function isShipAmmoCommodityKey(resourceKey: string): boolean {
  return /^shipammo_size_\d+$/.test(resourceKey.toLowerCase())
}

function isLunarEnvelopeCommodityKey(resourceKey: string): boolean {
  return resourceKey.toLowerCase().startsWith('special_lunar_envelope')
}

function isMiningOreCommodityKey(resourceKey: string): boolean {
  const key = resourceKey.toLowerCase()
  if (
    key.endsWith('_ore') ||
    key === 'quantainium' ||
    key === 'mixedmining' ||
    key === 'waste_rock' ||
    key === 'raw_ice' ||
    key === 'pressurized_ice' ||
    key === 'raw_silicon' ||
    key === 'raw_ouratite' ||
    key === 'ouratite'
  ) {
    return true
  }
  if (
    COMMODITY_FOOD_KEYS.has(key) ||
    COMMODITY_TRADE_KEYS.has(key) ||
    COMMODITY_ORDNANCE_KEYS.has(key) ||
    COMMODITY_FLAIR_KEYS.has(key) ||
    COMMODITY_MEDICAL_KEYS.has(key) ||
    COMMODITY_TYPE_CATEGORIES[key] ||
    isShipAmmoCommodityKey(key) ||
    isLunarEnvelopeCommodityKey(key)
  ) {
    return false
  }
  return getResourceType(normalizeCommodityKey(key)) === 'ore'
}

function getCommodityLoreCategory(resourceKey: string, label: string, description: string): string {
  const key = resourceKey.toLowerCase()
  const lowerLabel = label.toLowerCase()
  const text = `${lowerLabel} ${description.toLowerCase()}`

  if (COMMODITY_TYPE_CATEGORIES[key]) {
    return COMMODITY_TYPE_CATEGORIES[key]
  }

  if (
    COMMODITY_MEDICAL_KEYS.has(key) ||
    lowerLabel.includes('medical') ||
    lowerLabel.includes('medstick') ||
    lowerLabel.includes('kopion') ||
    lowerLabel.includes('molina') ||
    lowerLabel.includes('medpen') ||
    lowerLabel.includes('oxypen')
  ) {
    return 'Medical'
  }

  if (
    COMMODITY_FOOD_KEYS.has(key) ||
    HARVESTABLE_FOOD_DESCRIPTION.test(description) ||
    /\b(fresh food|processed food|food bar|distilled spirit)\b/i.test(text) ||
    (key.includes('food') && key !== 'organimass') ||
    key.includes('drink') ||
    key === 'distilled_spirits'
  ) {
    return 'Food & Drink'
  }

  if (
    isShipAmmoCommodityKey(key) ||
    COMMODITY_ORDNANCE_KEYS.has(key) ||
    /\bship ammunition\b/i.test(lowerLabel)
  ) {
    return 'Ordnance & Missiles'
  }

  if (
    COMMODITY_FLAIR_KEYS.has(key) ||
    isLunarEnvelopeCommodityKey(key) ||
    /\b(luminalia gift|souvenir|fireworks|party favor)\b/i.test(text)
  ) {
    return 'Flair & Collectibles'
  }

  if (COMMODITY_TRADE_KEYS.has(key) || /\b(agricultural goods|agricultural supplies|organics)\b/i.test(lowerLabel)) {
    return 'Trade Goods'
  }

  if (
    lowerLabel.includes('refined') ||
    COMMODITY_REFINED_KEYS.has(key) ||
    key.includes('_laminate') ||
    key.includes('composite')
  ) {
    return 'Refined Materials'
  }

  switch (getResourceType(normalizeCommodityKey(key))) {
    case 'ore':
      return isMiningOreCommodityKey(key) ? 'Ores & Minerals' : 'Trade Goods'
    case 'gem':
      return 'Gems & Hand Mineables'
    case 'gas':
    case 'halogen':
      return 'Gases'
    case 'fuel':
    case 'salvage':
      return 'Industrial'
    case 'contraband':
      return 'Contraband'
    case 'trade_good':
    case 'harvest':
    case 'shop_special':
      return 'Trade Goods'
    default:
      return 'Trade Goods'
  }
}

function getComponentCategoryFromLocKey(locKey: string): string | null {
  const upper = locKey.toUpperCase()
  for (const [code, category] of Object.entries(SHIP_COMPONENT_CODES)) {
    const token = code.toUpperCase()
    if (
      upper.includes(`_${token}_`) ||
      upper.includes(`${token}_`) ||
      upper.includes(`_${token}`) ||
      upper.includes(`DESC${token}_`)
    ) {
      return category
    }
  }
  return null
}

function getItemLoreCategory(resourceKey: string, locKey: string, label: string): string {
  const stem = resourceKey.toLowerCase()
  const lowerLabel = label.toLowerCase()
  const parts = stem.split('_')
  const first = parts[0] ?? stem

  const locCategory = getComponentCategoryFromLocKey(locKey)
  if (locCategory) return locCategory

  for (const part of parts) {
    const category = SHIP_COMPONENT_CODES[part]
    if (category) return category
  }

  if (
    /\blivery\b/i.test(label) ||
    /\bcamo\b/i.test(lowerLabel) ||
    /\bpaint job\b/i.test(lowerLabel) ||
    stem.includes('paint_') ||
    stem.startsWith('paint') ||
    stem.includes('_livery')
  ) {
    return 'Ship Paints & Liveries'
  }

  if (first === 'flair' || stem.startsWith('flair') || FLAIR_LABEL_PATTERN.test(lowerLabel)) {
    return 'Flair & Collectibles'
  }

  if (first === 'food' || first === 'drink') return 'Food & Drink'
  if (first === 'srvl' || stem.includes('salvage')) return 'Salvage & Industrial'
  if (first === 'cbd') return 'Consumables'

  if (WILDLIFE_STEMS.has(stem)) {
    return 'Wildlife'
  }

  if (
    stem.includes('medical_canister') ||
    stem.includes('medical_case') ||
    /\bmedical case\b/i.test(lowerLabel) ||
    (/\bmedical\b/i.test(lowerLabel) && /\b(container|case|canister)\b/i.test(lowerLabel))
  ) {
    return 'Medical'
  }

  if (stem.includes('microwave_energy') || stem.includes('uranium_core')) {
    return 'Ordnance & Missiles'
  }

  if (first === 'lplt' || stem.startsWith('powr_lplt')) {
    return SHIP_COMPONENTS
  }

  if (first === 'modu' || stem.startsWith('modu_')) {
    return SHIP_COMPONENTS
  }

  if (/\bmount\b/i.test(lowerLabel) && (stem.includes('placeholder') || stem.includes('class_2b'))) {
    return SHIP_COMPONENTS
  }

  if (first === 'arma' || stem.startsWith('arma_')) {
    return 'Optics & Attachments'
  }

  if (first === 'crlf' || stem.startsWith('crlf_')) {
    return 'Consumables'
  }

  if (CLOTHING_STEM_PREFIXES.has(first)) {
    return 'Armor & Clothing'
  }

  if (first === 'seco' || stem.startsWith('seco_')) {
    return SHIP_COMPONENTS
  }

  if (first === 'hackingchip' || stem.startsWith('hackingchip_')) {
    return 'Gadgets & Tools'
  }

  if (first === 'keycard' || stem.startsWith('keycard_')) {
    return 'Gadgets & Tools'
  }

  if (first === 'mining' || stem.startsWith('mining_')) {
    return 'Salvage & Industrial'
  }

  if (first === 'charm' || stem.startsWith('charm_')) {
    return 'Flair & Collectibles'
  }

  if (
    first === 'glass' ||
    stem.startsWith('ht_glass_') ||
    /\b(plant|planter|cactus|vine|bloom)\b/i.test(lowerLabel) ||
    stem.includes('_plant') ||
    first === 'dead_tree' ||
    first === 'xian_plant' ||
    stem === 'space_cactus'
  ) {
    return 'Flair & Collectibles'
  }

  if (
    first === 'ticket' ||
    stem.startsWith('patch_') ||
    stem.includes('currency') ||
    stem.includes('_scrip_') ||
    stem.includes('bathfloat') ||
    stem.includes('whale_suit') ||
    stem.startsWith('fl_dice_')
  ) {
    return 'Flair & Collectibles'
  }

  if (
    first === 'datapad' ||
    stem.includes('datapad') ||
    stem.startsWith('accesscard') ||
    stem.includes('hexpenetrator') ||
    stem.includes('powerbank') ||
    stem.includes('defibrillator') ||
    stem.includes('stimpack') ||
    stem.includes('fire_extinguisher') ||
    stem.includes('movable_trolley') ||
    stem.includes('fuse_') ||
    stem.includes('grapplebeam') ||
    first === 'klwe'
  ) {
    return 'Gadgets & Tools'
  }

  if (stem.startsWith('storall_') || stem.startsWith('lfsp_')) {
    return SHIP_COMPONENTS
  }

  if (first === 'umnt' || stem.startsWith('umnt_') || stem.startsWith('misc_reliant')) {
    return SHIP_COMPONENTS
  }

  if (stem.includes('deployable_shield') || stem.includes('_shield_01')) {
    return SHIP_COMPONENTS
  }

  if (stem.includes('_rpod_') || /\blib(erator|yebira)\b/i.test(lowerLabel)) {
    return 'Ordnance & Missiles'
  }

  if (
    first === 'tras' ||
    first === 'stka' ||
    stem.includes('trireme') ||
    stem.includes('laserbeam') ||
    (first === 'talon' && /\brack\b/i.test(lowerLabel))
  ) {
    return 'Ship Weapons & Turrets'
  }

  if (
    stem.includes('sensor_turret') ||
    stem.includes('wing_mount') ||
    stem.includes('sen_wing')
  ) {
    return SHIP_COMPONENTS
  }

  if (
    SHIP_COMPONENT_STEM_PREFIXES.has(first) ||
    /^qd/i.test(first) ||
    stem.includes('_qed_') ||
    stem.includes('_engine_') ||
    stem.includes('_hapr_') ||
    stem.includes('_jdrv_') ||
    stem.includes('_qdrv_')
  ) {
    return SHIP_COMPONENTS
  }

  if (/\bjetpack\b/i.test(lowerLabel) || stem.includes('jetpack')) {
    return 'Armor & Clothing'
  }

  if (stem.includes('_melee_') || (lowerLabel === 'shiv' && first === 'none')) {
    return 'FPS Weapons'
  }

  if (/\bgrenade\b/i.test(lowerLabel) && (first === 'ksar' || stem.includes('gren_frag'))) {
    return 'Gadgets & Tools'
  }

  if (stem.includes('emp_device') || stem.includes('rockcrack') || stem.includes('ltm_kinetic')) {
    return stem.includes('ltm') ? 'Ordnance & Missiles' : 'Salvage & Industrial'
  }

  if (first === 'hrst' || stem.startsWith('hrst_')) {
    if (/rpod|rocket|missile|torp/i.test(stem)) return 'Ordnance & Missiles'
    return 'Ship Weapons & Turrets'
  }

  if (first === 'vncl' || stem.startsWith('vncl_')) {
    if (/melee|blade/i.test(stem) && !/missilerack|laserbeam|tachyon|cannon/i.test(stem)) {
      return 'FPS Weapons'
    }
    return 'Ship Weapons & Turrets'
  }

  if (stem.endsWith('_mag') && first === 'behr') {
    return 'FPS Weapons'
  }

  if (
    first === 'behr' &&
    (/\bgrenade\b/i.test(lowerLabel) || stem.includes('binocular') || stem.includes('areadenial'))
  ) {
    return 'Gadgets & Tools'
  }

  if (stem.includes('crossbow') || first === 'utfl') {
    return 'FPS Weapons'
  }

  if (stem.endsWith('_ammo') && /\bgrenade\b/i.test(lowerLabel)) {
    return 'Gadgets & Tools'
  }

  if (
    (stem.startsWith('m_') || stem.startsWith('f_')) &&
    (stem.includes('_hair_') || stem.includes('_facial_') || stem.includes('_brow_'))
  ) {
    return 'Character Customization'
  }

  if (
    ARMOR_PIECE_STEM_PATTERN.test(stem) ||
    (ARMOR_SUIT_STEM_PREFIXES.has(first) &&
      (/_(arms|core|legs|helmet|suit)(_|$)/.test(stem) || /\b(arms|core|legs)\b/i.test(lowerLabel)) &&
      !stem.includes('turret'))
  ) {
    return 'Armor & Clothing'
  }

  if (
    first === 'playerdeco' ||
    stem.startsWith('carryable_') ||
    stem.startsWith('cup_') ||
    stem.startsWith('mug_') ||
    first === 'medal' ||
    first === 'currency' ||
    stem.includes('chess') ||
    stem.includes('_game_')
  ) {
    return 'Flair & Collectibles'
  }

  if (SHIP_WEAPON_STEM_PATTERN.test(stem) || /_(dual_s\d|spinal_mount)/.test(stem)) {
    return 'Ship Weapons & Turrets'
  }

  if (FPS_WEAPON_STEM_PATTERN.test(stem)) {
    return 'FPS Weapons'
  }

  if (
    stem.startsWith('countermeasure') ||
    stem.includes('decoy_grenade') ||
    stem.startsWith('un_portable_light') ||
    /special_ballistic/.test(stem)
  ) {
    if (/glauncher|apar_special/.test(stem) && !stem.endsWith('_mag')) {
      return 'FPS Weapons'
    }
    if (stem.endsWith('_mag') && /glauncher|apar_/.test(stem)) {
      return 'FPS Weapons'
    }
    return 'Ordnance & Missiles'
  }

  if (stem.endsWith('_shop') || /_shop$/i.test(locKey)) {
    return 'Ships & Flyable'
  }

  if (
    /\b(ball turret|nose turret|manned turret|ship turret|ballistic repeater|laser cannon|mass driver cannon|ship weapon|fixed weapon|varipuck|vari-puck|cannon\b|omnisky|singe cannon|evsd cannon|gatling|repeater\b|gimbal|spinal mount|quad rack)\b/i.test(
      lowerLabel
    ) ||
    (/\bturret\b/i.test(lowerLabel) && !/\b(fps|handheld)\b/i.test(lowerLabel))
  ) {
    return 'Ship Weapons & Turrets'
  }

  if (ORDNANCE_LABEL_PATTERN.test(lowerLabel) || /^(g?misl|torp|bomb)_/i.test(stem)) {
    if (/\b(pistol|rifle|smg|shotgun|sniper)\b/i.test(lowerLabel) && /\bammo\b/i.test(lowerLabel)) {
      return 'FPS Weapons'
    }
    return 'Ordnance & Missiles'
  }

  if (
    /\b(railgun|grenade launcher|scattergun)\b/i.test(lowerLabel) ||
    (/\bammo\b/i.test(lowerLabel) && /\b(magazine|mag)\b/i.test(lowerLabel) && /glauncher|apar_/.test(stem))
  ) {
    return 'FPS Weapons'
  }

  if (
    /\b(flashbang|smoke grenade|sedative|adrenapen|medpen|oxypen|detoxpen|boostpen|opiop|demexatrine|hemozal)\b/i.test(
      lowerLabel
    ) ||
    (first === 'rrs' && /\bgrenade\b/i.test(lowerLabel))
  ) {
    return first === 'rrs' && /\bgrenade\b/i.test(lowerLabel) ? 'Gadgets & Tools' : 'Consumables'
  }

  if (
    /\b(goggles|apron|scrubs|slippers|gown|trousers|shorts|shoes|glasses|suit|uniform)\b/i.test(
      lowerLabel
    )
  ) {
    return 'Armor & Clothing'
  }

  if (/\b(keycard|hacking chip|binocular|rangefinder|monocular)\b/i.test(lowerLabel)) {
    return 'Gadgets & Tools'
  }

  if (
    /\b(arms|core|legs|helmet)\b/i.test(lowerLabel) &&
    /\b(suit|armor|exploration|combat|specialist|utility)\b/i.test(lowerLabel)
  ) {
    return 'Armor & Clothing'
  }

  if (SHIP_COMPONENT_LABEL_PATTERN.test(lowerLabel) || /_(hapr|jdrv|qdrv)_/i.test(stem)) {
    return SHIP_COMPONENTS
  }

  if (
    stem.includes('optics') ||
    stem.includes('optic') ||
    /\b(scope|sight|rdot|holo|laser pointer|attachment)\b/i.test(lowerLabel)
  ) {
    return 'Optics & Attachments'
  }

  if (
    stem.includes('crafting') ||
    stem.includes('storage') ||
    stem.includes('container') ||
    stem.includes('claw') ||
    stem.includes('module') ||
    stem.includes('emitter') ||
    /stor\*?all/i.test(lowerLabel)
  ) {
    return SHIP_COMPONENTS
  }

  if (
    /\b(armor|helmet|jacket|shirt|pants|gloves|boots|flightsuit|undersuit|vest|coat|outfit|bodysuit|backpack|monocle|tophat|top hat|bandana|scarf|mask|hat\b|wear\b|clothing)\b/i.test(
      lowerLabel
    ) ||
    ARMOR_STEM_KEYWORDS.some((keyword) => stem.includes(keyword))
  ) {
    return 'Armor & Clothing'
  }

  if (
    FPS_WEAPON_KEYWORDS.some((keyword) => lowerLabel.includes(keyword)) ||
    (/\b(gun\b|weapon)\b/i.test(lowerLabel) && !/\bship\b/i.test(lowerLabel))
  ) {
    if (stem.includes('vehicle') || first === 'gv') return 'Ground Vehicles'
    return 'FPS Weapons'
  }

  if (stem.includes('consumable') && first === 'rrs') {
    return 'Consumables'
  }

  if (
    stem.includes('vehicle') ||
    stem.includes('ground') ||
    first === 'gv' ||
    /\b(cyclone|roc|nova|ballista|ursa rover|ptv|greycat|stv)\b/i.test(lowerLabel)
  ) {
    return 'Ground Vehicles'
  }

  if (
    first === 'grin' ||
    stem.includes('multitool') ||
    stem.includes('gadget') ||
    /\bflashlight\b/i.test(lowerLabel)
  ) {
    return 'Gadgets & Tools'
  }

  if (locKey.toLowerCase().includes('flbl') || stem.includes('flashlight')) {
    return 'Gadgets & Tools'
  }

  return 'Miscellaneous'
}

export function getGameLoreCategory(
  resourceKey: string,
  label: string,
  locKey: string,
  kind?: 'commodity' | 'item',
  description = ''
): string {
  const inferredKind =
    kind ??
    (locKey.toLowerCase().startsWith('items_commodities_') ||
    locKey.toLowerCase().startsWith('commodity_')
      ? 'commodity'
      : 'item')

  if (inferredKind === 'commodity') {
    return getCommodityLoreCategory(resourceKey, label, description)
  }

  return getItemLoreCategory(resourceKey, locKey, label)
}

/** Categories that should never be collapsed into Miscellaneous when small. */
const PROTECTED_CATEGORIES = new Set<string>([
  ...ITEM_LORE_CATEGORY_ORDER.filter((category) => category !== 'Miscellaneous'),
])

export function mergeSmallLoreCategories<T>(
  categories: Map<string, T[]>,
  minSize = LORE_MIN_CATEGORY_SIZE,
  fallbackCategory = 'Miscellaneous'
): Map<string, T[]> {
  const merged = new Map<string, T[]>()
  const orphans: T[] = []

  for (const [category, entries] of categories) {
    if (
      category === fallbackCategory ||
      entries.length >= minSize ||
      PROTECTED_CATEGORIES.has(category)
    ) {
      const existing = merged.get(category) ?? []
      merged.set(category, [...existing, ...entries])
      continue
    }
    orphans.push(...entries)
  }

  if (orphans.length > 0) {
    merged.set(fallbackCategory, [...(merged.get(fallbackCategory) ?? []), ...orphans])
  }

  return merged
}
