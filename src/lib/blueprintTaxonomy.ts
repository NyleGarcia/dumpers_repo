export const FPS_WEAPON_TYPE_OPTIONS = [
  'crossbow',
  'lmg',
  'pistol',
  'rifle',
  'shotgun',
  'smg',
  'sniper',
] as const

export interface BlueprintTaxonomyInput {
  file?: string
  blueprintName?: string
  categoryName?: string
  subCategoryName?: string
}

function getFpsWeaponTypeFromFilename(filename: string): string | null {
  const fn = filename.toLowerCase()
  for (const type of FPS_WEAPON_TYPE_OPTIONS) {
    if (fn.includes(`_${type}_`) || fn.includes(`_${type}.`)) return type
  }
  return null
}

export function formatTaxonomyLabel(value: string | null | undefined): string | null {
  if (!value) return null
  if (value === 'superheavy') return 'Super Heavy'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getBlueprintSubType(bp: BlueprintTaxonomyInput): string | null {
  if (!bp.file) return null
  const parts = bp.file.split('\\')
  const filename = parts[parts.length - 1] || ''

  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === 'vehiclegear' && parts[i + 1] === 'weapons') {
      let next = parts[i + 2]?.replace('$', '')
      if (next === 'templates' && parts[i + 3]) next = parts[i + 3]
      return next || null
    }
    if (parts[i] === 'weapons' && parts[i - 1] === 'fpsgear') {
      let sub = parts[i + 1]?.replace('$', '')
      if (sub === 'templates') {
        return getFpsWeaponTypeFromFilename(filename)
      }
      return sub
    }
    if (parts[i] === 'ammo' && parts[i - 1] === 'fpsgear') {
      const fromFilename = getFpsWeaponTypeFromFilename(filename)
      if (fromFilename) return fromFilename
      const folderType = parts[i + 1]?.replace('$', '')
      if (folderType && FPS_WEAPON_TYPE_OPTIONS.includes(folderType as (typeof FPS_WEAPON_TYPE_OPTIONS)[number])) {
        return folderType
      }
      return null
    }
    if (parts[i] === 'armour' && parts[i - 1] === 'fpsgear') {
      let sub = parts[i + 1]?.replace('$', '')
      if (sub === 'templates' && parts[i + 2]) sub = parts[i + 2]
      if (sub === 'combat') return 'standard'
      if (sub === 'flightsuit') {
        if (filename.includes('_helmet')) return 'standard'
        return 'flightsuit'
      }
      return sub
    }
    if (parts[i] === 'vehiclegear' && parts[i + 1] !== 'weapons') {
      return parts[i + 1]?.replace('$', '') ?? null
    }
  }
  return null
}

export function getAmmoDamageType(bp: BlueprintTaxonomyInput): string | null {
  if (!bp.file || bp.categoryName !== 'Ammo') return null
  const parts = bp.file.split('\\')
  const ammoIdx = parts.indexOf('ammo')
  if (ammoIdx < 0) return null
  const segment = parts[ammoIdx + 1]?.replace('$', '')?.toLowerCase()
  if (!segment || FPS_WEAPON_TYPE_OPTIONS.includes(segment as (typeof FPS_WEAPON_TYPE_OPTIONS)[number])) {
    return null
  }
  return segment
}

function getArmorWeightFromPath(parts: string[]): string | null {
  const armourIdx = parts.indexOf('armour')
  if (armourIdx < 0) return null
  for (let i = armourIdx + 1; i < parts.length - 1; i++) {
    const segment = parts[i]?.toLowerCase()
    if (segment && ['superheavy', 'heavy', 'medium', 'light'].includes(segment)) return segment
  }
  return null
}

function isFlightArmor(parts: string[], filename: string, blueprintName = ''): boolean {
  if (parts.some((p) => p.toLowerCase() === 'flightsuit')) return true
  if (parts.some((p) => p.toLowerCase() === 'racer')) return true
  if (filename.includes('flightsuit')) return true
  const name = blueprintName.toLowerCase()
  return name.includes('flight') || name.includes('racing')
}

export function getArmorWeight(bp: BlueprintTaxonomyInput): string | null {
  if (!bp.file) return null
  const parts = bp.file.split('\\')
  const filename = parts[parts.length - 1]?.toLowerCase() || ''
  const isArmor = parts.some((p, i) => p === 'armour' && parts[i - 1] === 'fpsgear')
  if (!isArmor) return null

  if (isFlightArmor(parts, filename, bp.blueprintName)) return 'flight'
  if (filename.includes('_superheavy_') || filename.includes('_superheavy.')) return 'superheavy'
  if (filename.includes('_heavy_') || filename.includes('_heavy.')) return 'heavy'
  if (filename.includes('_medium_') || filename.includes('_medium.')) return 'medium'
  if (filename.includes('_light_') || filename.includes('_light.')) return 'light'

  const fromPath = getArmorWeightFromPath(parts)
  if (fromPath) return fromPath
  if (parts.some((p) => p.toLowerCase() === 'undersuit')) return 'light'

  return null
}

export function getArmorSlot(bp: BlueprintTaxonomyInput): string | null {
  if (!bp.file) return null
  const parts = bp.file.split('\\')
  const filename = parts[parts.length - 1]?.toLowerCase() || ''
  const isArmor = parts.some((p, i) => p === 'armour' && parts[i - 1] === 'fpsgear')
  if (!isArmor) return null

  if (filename.includes('_helmet')) return 'helmet'
  if (filename.includes('_arms')) return 'arms'
  if (filename.includes('_core') || filename.includes('_jacket')) return 'core'
  if (filename.includes('_legs') || filename.includes('_pants')) return 'legs'
  if (filename.includes('_backpack') || filename.includes('backpack_')) return 'backpack'

  return null
}

export function extractComponentSize(categoryName?: string): string | null {
  if (!categoryName) return null
  const match = categoryName.match(/S(\d+)/i)
  return match ? `S${match[1]}` : null
}
