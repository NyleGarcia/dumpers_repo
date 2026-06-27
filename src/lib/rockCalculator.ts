import type { CompositionPart } from './miningClusterProfiles'
import { pricingForResourceLine } from './orderPricing'
import { MINING_LEDGER_PRICE_QUALITY } from './miningLedger'

export const PERCENT_OVER_LIMIT = 100.001

export function calculateMaterialScu(totalScu: number, percent: number): number {
  if (!Number.isFinite(totalScu) || totalScu <= 0) return 0
  if (!Number.isFinite(percent) || percent <= 0) return 0
  return Math.round(totalScu * percent * 10) / 1000
}

export function sumPercentages(values: number[]): number {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
}

export function isPercentOverLimit(total: number): boolean {
  return total > PERCENT_OVER_LIMIT
}

export function formatMaterialScu(scu: number): string {
  return scu.toFixed(3)
}

export function parsePercentInput(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const value = Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : 0
}

export function parseTotalScuInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number.parseFloat(trimmed)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export function formatCompositionRowLabel(
  part: CompositionPart,
  allParts: CompositionPart[]
): string {
  const duplicateCount = allParts.filter((p) => p.elementName === part.elementName).length
  if (duplicateCount > 1 || part.qualityScale !== 1) {
    return `${part.elementName} (Q×${part.qualityScale})`
  }
  return part.elementName
}

export function formatCompositionRangeHint(part: CompositionPart): string {
  return `${part.minPercentage}–${part.maxPercentage}%`
}

export function compositionSlotKey(index: number): string {
  return `slot-${index}`
}

export function buildDefaultPercentSlots(parts: CompositionPart[]): Record<string, string> {
  const initial: Record<string, string> = {}
  parts.forEach((_, index) => {
    initial[compositionSlotKey(index)] = '0'
  })
  return initial
}

function oreResourceKey(elementName: string): string {
  return elementName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Purchased Q0 Dumper's Fair-Value Price for the given cSCU amount. */
export function calculateMaterialDfpValue(elementName: string, scu: number): number {
  if (!Number.isFinite(scu) || scu <= 0) return 0
  const { lineDfpAuec } = pricingForResourceLine(
    oreResourceKey(elementName),
    elementName,
    MINING_LEDGER_PRICE_QUALITY,
    scu
  )
  if (!Number.isFinite(lineDfpAuec) || lineDfpAuec <= 0) return 0
  return Math.round(lineDfpAuec)
}

export function formatRockDfpValue(auec: number): string {
  return auec.toLocaleString()
}
