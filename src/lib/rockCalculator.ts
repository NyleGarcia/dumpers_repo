import type { CompositionPart } from './miningClusterProfiles'
import { pricingForResourceLine } from './orderPricing'
import {
  DEFAULT_QUALITY,
  getDefaultBandQuality,
  getResourceBands,
  PURCHASED_STOCK_QUALITY,
} from './qualityBands'

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

const SCANNER_BAND_SUFFIXES = ['High', 'Low'] as const

/** In-game scanner label: duplicate element slots become High / Low by qualityScale. */
export function formatScannerBandLabel(
  part: CompositionPart,
  index: number,
  allParts: CompositionPart[]
): string {
  const sameElement = allParts
    .map((p, i) => ({ part: p, index: i }))
    .filter(({ part: p }) => p.elementName === part.elementName)

  if (sameElement.length <= 1) return part.elementName

  const sorted = [...sameElement].sort((a, b) => b.part.qualityScale - a.part.qualityScale)
  const rank = sorted.findIndex(({ index: i }) => i === index)
  if (rank < 0) return part.elementName

  const suffix =
    rank < SCANNER_BAND_SUFFIXES.length
      ? SCANNER_BAND_SUFFIXES[rank]
      : `Band ${rank + 1}`
  return `${part.elementName} · ${suffix}`
}

export function formatScannerBandTooltip(
  part: CompositionPart,
  index: number,
  allParts: CompositionPart[]
): string | undefined {
  const duplicateCount = allParts.filter((p) => p.elementName === part.elementName).length
  if (duplicateCount <= 1) return undefined
  return `Q×${part.qualityScale}`
}

/** @deprecated Use formatScannerBandLabel with slot index. */
export function formatCompositionRowLabel(
  part: CompositionPart,
  allParts: CompositionPart[]
): string {
  const index = allParts.indexOf(part)
  return formatScannerBandLabel(part, index >= 0 ? index : 0, allParts)
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

/** Band 2 (or Q500 fallback) per composition slot when ore/location profile loads. */
export function buildDefaultQualitySlots(parts: CompositionPart[]): Record<string, string> {
  const initial: Record<string, string> = {}
  parts.forEach((part, index) => {
    initial[compositionSlotKey(index)] = String(getDefaultBandQuality(part.elementName))
  })
  return initial
}

export function parseQualitySlotValue(raw: string, fallback = DEFAULT_QUALITY): number {
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : fallback
}

export function formatRockQualityOptionLabel(quality: number): string {
  if (quality === PURCHASED_STOCK_QUALITY) return 'Q0'
  return `Q${quality}`
}

export function formatRockQualitySelectTitle(
  elementName: string,
  quality: number,
  bands?: number[]
): string {
  if (quality === PURCHASED_STOCK_QUALITY) return 'Purchased (Q0)'
  const resolvedBands = bands ?? getResourceBands(elementName)
  if (resolvedBands) {
    const idx = resolvedBands.indexOf(quality)
    if (idx >= 0) return `Band ${idx + 1}: Q${quality}`
  }
  return `Q${quality}`
}

export function oreResourceKeyFromElementName(elementName: string): string {
  return elementName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Purchased Q0 Dumper's Fair-Value Price for the given cSCU amount (calculator display only). */
export function calculateMaterialDfpValue(elementName: string, scu: number): number {
  if (!Number.isFinite(scu) || scu <= 0) return 0
  const { lineDfpAuec } = pricingForResourceLine(
    oreResourceKeyFromElementName(elementName),
    elementName,
    PURCHASED_STOCK_QUALITY,
    scu
  )
  if (!Number.isFinite(lineDfpAuec) || lineDfpAuec <= 0) return 0
  return Math.round(lineDfpAuec)
}

export function formatRockDfpValue(auec: number): string {
  return auec.toLocaleString()
}
