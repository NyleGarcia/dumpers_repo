export const WTS_PARTIAL_MAX_ADJUST_PCT = 20
export const WTS_FULL_MAX_ADJUST_PCT = 10

export interface WtsAdjustableLine {
  baseUnitDfpAuec: number
  baseLineDfpAuec: number
  quantity: number
  priceAdjustmentPct?: number
}

export interface WtsListedLinePrices {
  unitDfpAuec: number
  lineDfpAuec: number
}

export function clampAdjustmentPct(pct: number, maxPct: number): number {
  return Math.max(-maxPct, Math.min(maxPct, pct))
}

export function applyUnitPriceAdjustment(baseUnit: number, pct: number): number {
  return Math.max(0, Math.round(baseUnit * (1 + pct / 100)))
}

export function applyLinePriceAdjustment(
  baseUnit: number,
  quantity: number,
  pct: number
): WtsListedLinePrices {
  const unitDfpAuec = applyUnitPriceAdjustment(baseUnit, pct)
  const qty = Math.max(quantity, 0)
  return {
    unitDfpAuec,
    lineDfpAuec: Math.max(0, Math.round(unitDfpAuec * qty)),
  }
}

export function getLineQuantity(line: { quantity?: number; quantityScu?: number }): number {
  if (line.quantityScu != null) return line.quantityScu
  return line.quantity ?? 1
}

export function applyPartialLineAdjustment<T extends WtsAdjustableLine & { quantity?: number; quantityScu?: number }>(
  line: T,
  pct: number
): T {
  const listed = applyLinePriceAdjustment(
    line.baseUnitDfpAuec,
    getLineQuantity(line),
    clampAdjustmentPct(pct, WTS_PARTIAL_MAX_ADJUST_PCT)
  )
  return {
    ...line,
    priceAdjustmentPct: clampAdjustmentPct(pct, WTS_PARTIAL_MAX_ADJUST_PCT),
    unitDfpAuec: listed.unitDfpAuec,
    lineDfpAuec: listed.lineDfpAuec,
  }
}

export function createCartPricingFields(
  unitDfpAuec: number,
  lineDfpAuec: number,
  priceAdjustmentPct = 0
): {
  baseUnitDfpAuec: number
  baseLineDfpAuec: number
  priceAdjustmentPct: number
  unitDfpAuec: number
  lineDfpAuec: number
} {
  return {
    baseUnitDfpAuec: unitDfpAuec,
    baseLineDfpAuec: lineDfpAuec,
    priceAdjustmentPct,
    unitDfpAuec,
    lineDfpAuec,
  }
}

export function deriveAdjustmentPct(baseUnit: number, listedUnit: number): number {
  if (baseUnit <= 0) return 0
  const pct = ((listedUnit - baseUnit) / baseUnit) * 100
  return Math.round(pct)
}

export function deriveOrderAdjustmentPct(baseTotal: number, listedTotal: number): number {
  if (baseTotal <= 0) return 0
  const pct = ((listedTotal - baseTotal) / baseTotal) * 100
  return Math.round(pct)
}

export interface WtsOrderAdjustableLine extends WtsAdjustableLine {
  cartKey: string
  kind: 'blueprint' | 'resource'
}

export function applyOrderTotalAdjustment(
  lines: WtsOrderAdjustableLine[],
  orderPct: number
): Map<string, WtsListedLinePrices> {
  const factor = 1 + orderPct / 100
  const result = new Map<string, WtsListedLinePrices>()

  for (const line of lines) {
    const adjustedLineTotal = Math.max(0, Math.round(line.baseLineDfpAuec * factor))
    const qty = Math.max(line.quantity, 0.001)
    const unitDfpAuec =
      line.kind === 'blueprint'
        ? Math.max(0, Math.round(adjustedLineTotal / Math.max(1, Math.trunc(qty))))
        : Math.max(0, Math.round(adjustedLineTotal / qty))
    result.set(line.cartKey, {
      unitDfpAuec,
      lineDfpAuec: adjustedLineTotal,
    })
  }

  return result
}

export function sumLineTotals(lines: Pick<WtsAdjustableLine, 'lineDfpAuec'>[]): number {
  return lines.reduce((sum, line) => sum + line.lineDfpAuec, 0)
}

export function sumBaseLineTotals(lines: Pick<WtsAdjustableLine, 'baseLineDfpAuec'>[]): number {
  return lines.reduce((sum, line) => sum + line.baseLineDfpAuec, 0)
}

export interface WtsSubmitBlueprintLine {
  blueprintId: string
  blueprintTitle: string
  minQuality: number
  slotQualities?: Record<number, number>
  quantity: number
  unitDfpAuec: number
  lineDfpAuec: number
  baseUnitDfpAuec: number
}

export interface WtsSubmitResourceLine {
  resourceKey: string
  resourceLabel: string
  minQuality: number
  quantityScu: number
  unitDfpAuec: number
  lineDfpAuec: number
  baseUnitDfpAuec: number
}

export interface WtsCartLineInput {
  cartKey: string
  baseUnitDfpAuec: number
  baseLineDfpAuec: number
  priceAdjustmentPct: number
  unitDfpAuec: number
  lineDfpAuec: number
  quantity?: number
  quantityScu?: number
}

export function buildWtsListedTotals(
  blueprintLines: WtsCartLineInput[],
  resourceLines: WtsCartLineInput[],
  sellEntireListing: boolean,
  orderPriceAdjustmentPct: number
): {
  blueprintPrices: Map<string, WtsListedLinePrices>
  resourcePrices: Map<string, WtsListedLinePrices>
  totalDfpAuec: number
} {
  const adjustable: WtsOrderAdjustableLine[] = [
    ...blueprintLines.map((line) => ({
      cartKey: line.cartKey,
      kind: 'blueprint' as const,
      baseUnitDfpAuec: line.baseUnitDfpAuec,
      baseLineDfpAuec: line.baseLineDfpAuec,
      quantity: line.quantity ?? 1,
      priceAdjustmentPct: line.priceAdjustmentPct,
    })),
    ...resourceLines.map((line) => ({
      cartKey: line.cartKey,
      kind: 'resource' as const,
      baseUnitDfpAuec: line.baseUnitDfpAuec,
      baseLineDfpAuec: line.baseLineDfpAuec,
      quantity: line.quantityScu ?? 1,
      priceAdjustmentPct: line.priceAdjustmentPct,
    })),
  ]

  const blueprintPrices = new Map<string, WtsListedLinePrices>()
  const resourcePrices = new Map<string, WtsListedLinePrices>()

  if (sellEntireListing) {
    const adjusted = applyOrderTotalAdjustment(adjustable, orderPriceAdjustmentPct)
    for (const line of blueprintLines) {
      blueprintPrices.set(line.cartKey, adjusted.get(line.cartKey)!)
    }
    for (const line of resourceLines) {
      resourcePrices.set(line.cartKey, adjusted.get(line.cartKey)!)
    }
    const totalDfpAuec = [...adjusted.values()].reduce((sum, row) => sum + row.lineDfpAuec, 0)
    return { blueprintPrices, resourcePrices, totalDfpAuec }
  }

  for (const line of blueprintLines) {
    blueprintPrices.set(
      line.cartKey,
      applyLinePriceAdjustment(
        line.baseUnitDfpAuec,
        line.quantity ?? 1,
        clampAdjustmentPct(line.priceAdjustmentPct, WTS_PARTIAL_MAX_ADJUST_PCT)
      )
    )
  }
  for (const line of resourceLines) {
    resourcePrices.set(
      line.cartKey,
      applyLinePriceAdjustment(
        line.baseUnitDfpAuec,
        line.quantityScu ?? 1,
        clampAdjustmentPct(line.priceAdjustmentPct, WTS_PARTIAL_MAX_ADJUST_PCT)
      )
    )
  }

  const totalDfpAuec =
    [...blueprintPrices.values(), ...resourcePrices.values()].reduce(
      (sum, row) => sum + row.lineDfpAuec,
      0
    )

  return { blueprintPrices, resourcePrices, totalDfpAuec }
}

export function computeCartListTotalDfp(
  blueprintLines: WtsCartLineInput[],
  resourceLines: WtsCartLineInput[],
  sellEntireListing: boolean,
  orderPriceAdjustmentPct: number
): number {
  return buildWtsListedTotals(
    blueprintLines,
    resourceLines,
    sellEntireListing,
    orderPriceAdjustmentPct
  ).totalDfpAuec
}
