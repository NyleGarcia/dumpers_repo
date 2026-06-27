import { getArmorSlot, type BlueprintTaxonomyInput } from './blueprintTaxonomy'

export const FPS_VARIANT_CATEGORIES = new Set(['FPSWeapons', 'FPSArmours'])

const ARMOR_SLOT_WORDS = ['Helmet', 'Arms', 'Core', 'Legs', 'Backpack'] as const
const ARMOR_SLOT_ORDER: Record<string, number> = {
  helmet: 0,
  arms: 1,
  core: 2,
  legs: 3,
  backpack: 4,
}

export interface BlueprintVariantInput extends BlueprintTaxonomyInput {
  internalName?: string
  blueprintName?: string
  categoryName?: string
}

export type BlueprintGridItem =
  | { kind: 'single'; blueprint: BlueprintVariantInput }
  | {
      kind: 'group'
      familyKey: string
      familyLabel: string
      categoryName: string
      members: BlueprintVariantInput[]
    }

const ARMOR_SLOT_PATTERN = new RegExp(
  `\\b(${ARMOR_SLOT_WORDS.join('|')})\\b`,
  'i'
)

function stripWeaponVariantSuffix(internalName: string): string {
  return internalName
    .replace(/_tint\d+$/i, '')
    .replace(/_xenothreat\d+$/i, '')
    .replace(/_[a-z]+_[a-z]+\d+$/i, '')
}

function getWeaponDisplayBase(blueprintName: string): string {
  return blueprintName.replace(/\s+"[^"]+"\s+/, ' ').trim()
}

function getArmorProductLine(blueprintName: string): string | null {
  const match = blueprintName.match(ARMOR_SLOT_PATTERN)
  if (!match || match.index === undefined) return null
  const line = blueprintName.slice(0, match.index).trim()
  return line || null
}

export function getFpsVariantFamilyKey(bp: BlueprintVariantInput): string | null {
  if (!bp.categoryName || !FPS_VARIANT_CATEGORIES.has(bp.categoryName)) return null

  if (bp.categoryName === 'FPSArmours') {
    const line = getArmorProductLine(bp.blueprintName || '')
    return line || null
  }

  const internal = bp.internalName || ''
  if (internal) {
    const stripped = stripWeaponVariantSuffix(internal)
    if (stripped) return stripped
  }

  const displayBase = getWeaponDisplayBase(bp.blueprintName || '')
  return displayBase || null
}

export function getFpsVariantFamilyLabel(
  bp: BlueprintVariantInput,
  familyKey: string
): string {
  if (bp.categoryName === 'FPSArmours') {
    return familyKey
  }

  const displayBase = getWeaponDisplayBase(bp.blueprintName || '')
  return displayBase || familyKey
}

function sortGroupMembers(members: BlueprintVariantInput[], categoryName: string): void {
  if (categoryName === 'FPSArmours') {
    members.sort((a, b) => {
      const slotA = getArmorSlot(a) || ''
      const slotB = getArmorSlot(b) || ''
      const orderA = ARMOR_SLOT_ORDER[slotA] ?? 99
      const orderB = ARMOR_SLOT_ORDER[slotB] ?? 99
      if (orderA !== orderB) return orderA - orderB
      return (a.blueprintName || '').localeCompare(b.blueprintName || '')
    })
    return
  }

  members.sort((a, b) => {
    const baseA = getWeaponDisplayBase(a.blueprintName || '')
    const baseB = getWeaponDisplayBase(b.blueprintName || '')
    if (baseA.length !== baseB.length) return baseA.length - baseB.length
    return baseA.localeCompare(baseB)
  })
}

function countBaseMembers(members: BlueprintVariantInput[], categoryName: string): number {
  if (categoryName === 'FPSWeapons') {
    return members.filter((m) => !/"[^"]+"/.test(m.blueprintName || '')).length
  }
  return members.filter((m) => /_01$/.test(m.internalName || '')).length
}

export function getVariantGroupSummary(
  members: BlueprintVariantInput[],
  categoryName: string
): string {
  const baseCount = countBaseMembers(members, categoryName)
  const variantCount = members.length - baseCount
  if (baseCount >= 1 && variantCount >= 1) {
    return `Base + ${variantCount} variant${variantCount !== 1 ? 's' : ''}`
  }
  return `${members.length} variant${members.length !== 1 ? 's' : ''}`
}

export function buildBlueprintGridItems(
  blueprints: BlueprintVariantInput[],
  groupVariants: boolean
): BlueprintGridItem[] {
  if (!groupVariants) {
    return blueprints.map((blueprint) => ({ kind: 'single', blueprint }))
  }

  type PendingGroup = {
    familyKey: string
    familyLabel: string
    categoryName: string
    members: BlueprintVariantInput[]
    firstIndex: number
  }

  const groups = new Map<string, PendingGroup>()
  const output: { item: BlueprintGridItem; index: number }[] = []

  blueprints.forEach((bp, index) => {
    if (!bp.categoryName || !FPS_VARIANT_CATEGORIES.has(bp.categoryName)) {
      output.push({ item: { kind: 'single', blueprint: bp }, index })
      return
    }

    const variantKey = getFpsVariantFamilyKey(bp)
    if (!variantKey) {
      output.push({ item: { kind: 'single', blueprint: bp }, index })
      return
    }

    const fullKey = `${bp.categoryName}:${variantKey}`
    const existing = groups.get(fullKey)
    if (existing) {
      existing.members.push(bp)
    } else {
      groups.set(fullKey, {
        familyKey: fullKey,
        familyLabel: getFpsVariantFamilyLabel(bp, variantKey),
        categoryName: bp.categoryName,
        members: [bp],
        firstIndex: index,
      })
    }
  })

  for (const group of groups.values()) {
    if (group.members.length >= 2) {
      sortGroupMembers(group.members, group.categoryName)
      output.push({
        item: {
          kind: 'group',
          familyKey: group.familyKey,
          familyLabel: group.familyLabel,
          categoryName: group.categoryName,
          members: group.members,
        },
        index: group.firstIndex,
      })
    } else {
      output.push({
        item: { kind: 'single', blueprint: group.members[0] },
        index: group.firstIndex,
      })
    }
  }

  output.sort((a, b) => a.index - b.index)
  return output.map((entry) => entry.item)
}
