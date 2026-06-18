import { isSalvageResource } from '../config/extraResources'
import { isHarvestResource } from '../config/resourceTypes'
import { AMMO_ORDER_MIN_QUALITY } from '../config/dfp'
import { resolveBlueprintRequirementLabel } from './blueprintResources'
import { getDfpEngine } from './dfpEngine'

const MIN_SCU = 0.001

/** Names the DFP engine expects but differ from parsed blueprint display labels. */
const DFP_ENGINE_RESOURCE_ALIASES: Record<string, string> = {
  Saldynium: 'Saldynium (Ore)',
}

function resolveDfpEngineResourceName(name: string): string {
  return DFP_ENGINE_RESOURCE_ALIASES[name] ?? name
}

function normalizeBlueprintForDfp(blueprint: BlueprintDfpInput): BlueprintDfpInput {
  if (!blueprint.slots?.length) return blueprint

  return {
    ...blueprint,
    slots: blueprint.slots.map((slot) => ({
      ...slot,
      options: (slot.options ?? []).map((option) => {
        const rawName =
          option.resourceName ||
          option.entityName ||
          resolveBlueprintRequirementLabel(option)
        if (!rawName) return option

        const engineName = resolveDfpEngineResourceName(rawName)
        if (option.resourceName) {
          return { ...option, resourceName: engineName }
        }
        if (option.entityName) {
          return { ...option, entityName: engineName }
        }
        return { ...option, entityName: engineName }
      }),
    })),
  }
}

export interface DfpLineItem {
  resource: string
  quality: number
  scu: number
  baseValue: number
  modifier: number
  lineTotal: number
}

export interface DfpResult {
  materialTotal: number
  acquisitionPremium: number
  craftLaborPremium: number
  typeModifier: number
  typeKey: string
  total: number
  lines: DfpLineItem[]
}

export interface BlueprintDfpInput {
  file?: string
  categoryName?: string
  subCategoryName?: string
  slots?: {
    requiredCount?: number
    options?: {
      type?: string
      resourceName?: string
      entityName?: string
      itemName?: string
      displayName?: string
      minQuality?: number
      standardCargoUnits?: number
      quantity?: number
    }[]
  }[]
}

export function isAmmoBlueprint(blueprint: BlueprintDfpInput): boolean {
  return getDfpEngine().isAmmoBlueprint(blueprint)
}

export function formatBlueprintOrderQualityLabel(minQuality: number): string {
  if (minQuality === AMMO_ORDER_MIN_QUALITY) return 'Any (ammo)'
  return `Q${minQuality}`
}

export function formatResourceOrderQualityLabel(
  resourceKey: string,
  _label: string,
  minQuality: number
): string {
  if (isSalvageResource(resourceKey)) return 'Q0 (salvage)'
  if (isHarvestResource(resourceKey)) return 'Harvest'
  return `Q${minQuality}`
}

/** @deprecated Use formatBlueprintOrderQualityLabel or formatResourceOrderQualityLabel */
export function formatOrderQualityLabel(minQuality: number): string {
  return formatBlueprintOrderQualityLabel(minQuality)
}

export function resolveDfpTypeKey(blueprint: BlueprintDfpInput): string {
  const eng = getDfpEngine()
  if (eng.isAmmoBlueprint(blueprint)) return 'ammo'
  const cat = blueprint.categoryName ?? ''
  if (cat === 'FPSArmours') return 'armor'
  if (cat === 'FPSWeapons') return 'fps_weapon'
  if (cat === 'MissionItem') return 'mission_item'
  if (cat.startsWith('Veh. Comp.')) {
    const sub = blueprint.subCategoryName ?? 'default'
    const match = cat.match(/S(\d+)/i)
    return match ? `ship_component:${sub}:S${match[1]}` : `ship_component:${sub}`
  }
  if (cat.startsWith('Veh. Weapons')) return 'vehicle_weapon'
  return 'other'
}

export function calculateMaterialDfpPrice(
  resourceName: string,
  minQuality: number,
  scuQuantity: number
): number {
  return getDfpEngine().calculateMaterialDfpPrice(resourceName, minQuality, scuQuantity)
}

export function calculateMaterialDfpLine(
  resourceName: string,
  minQuality: number,
  scuQuantity: number
): DfpLineItem {
  const lineTotal = calculateMaterialDfpPrice(resourceName, minQuality, scuQuantity)
  const scu = Math.max(scuQuantity, MIN_SCU)
  return {
    resource: resourceName,
    quality: minQuality,
    scu,
    baseValue: 0,
    modifier: 0,
    lineTotal,
  }
}

function normalizeDfpResult(
  raw: {
    materialTotal: number
    acquisitionPremium?: number
    craftLaborPremium?: number
    typeModifier: number
    total: number
    lines: unknown[]
  },
  blueprint: BlueprintDfpInput,
  craftQuantity = 1
): DfpResult {
  const qty = Math.max(1, craftQuantity)
  const acquisitionPremium = Math.round((raw.acquisitionPremium ?? 0) * qty)
  const craftLaborPremium = Math.round((raw.craftLaborPremium ?? 0) * qty)
  return {
    materialTotal: Math.round(raw.materialTotal * qty),
    acquisitionPremium,
    craftLaborPremium,
    typeModifier: raw.typeModifier,
    typeKey: resolveDfpTypeKey(blueprint),
    total: Math.round(raw.materialTotal * qty) + acquisitionPremium + craftLaborPremium,
    lines: raw.lines as DfpLineItem[],
  }
}

export function calculateBlueprintDfpForOrder(
  blueprint: BlueprintDfpInput,
  orderMinQuality: number,
  craftQuantity = 1
): DfpResult {
  const normalized = normalizeBlueprintForDfp(blueprint)
  const raw = getDfpEngine().calculateBlueprintDfpForOrder(
    normalized,
    orderMinQuality,
    craftQuantity
  )
  if (raw.acquisitionPremium != null || raw.craftLaborPremium != null) {
    return {
      materialTotal: raw.materialTotal,
      acquisitionPremium: raw.acquisitionPremium ?? 0,
      craftLaborPremium: raw.craftLaborPremium ?? 0,
      typeModifier: raw.typeModifier,
      typeKey: resolveDfpTypeKey(blueprint),
      total: raw.total,
      lines: raw.lines as DfpLineItem[],
    }
  }
  return normalizeDfpResult(raw, blueprint, craftQuantity)
}

export function calculateBlueprintDfp(blueprint: BlueprintDfpInput): DfpResult {
  const raw = getDfpEngine().calculateBlueprintDfp(normalizeBlueprintForDfp(blueprint))
  return {
    materialTotal: raw.materialTotal,
    acquisitionPremium: raw.acquisitionPremium ?? 0,
    craftLaborPremium: raw.craftLaborPremium ?? 0,
    typeModifier: raw.typeModifier,
    typeKey: resolveDfpTypeKey(blueprint),
    total: raw.total,
    lines: raw.lines as DfpLineItem[],
  }
}

export function formatDfpValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'

  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  if (abs >= 100) return Math.round(value).toLocaleString()
  return value.toFixed(1)
}

export function formatDfpLabel(value: number): string {
  const formatted = formatDfpValue(value)
  if (formatted === '—') return 'DFP —'
  return `DFP ${formatted}`
}

export function formatCraftDfpBreakdown(result: DfpResult): string {
  const parts = [`Materials ${formatDfpValue(result.materialTotal)}`]
  if (result.acquisitionPremium > 0) {
    parts.push(`Acquire ${formatDfpValue(result.acquisitionPremium)}`)
  }
  if (result.craftLaborPremium > 0) {
    parts.push(`Labor ${formatDfpValue(result.craftLaborPremium)}`)
  }
  parts.push(`= ${formatDfpValue(result.total)}`)
  return parts.join(' + ')
}

export function formatDfpAuec(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${Math.round(value).toLocaleString()} aUEC`
}

export function formatDfpRequiredPrice(value: number): string {
  const auec = formatDfpAuec(value)
  if (auec === '—') return 'DFP —'
  return `${auec} (DFP required)`
}
