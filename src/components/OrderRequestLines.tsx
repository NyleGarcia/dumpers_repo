import React, { useMemo, useState } from 'react'
import {
  formatBlueprintOrderQualityLabel,
  formatDfpAuec,
  formatResourceOrderQualityLabel,
} from '../lib/dfp'
import {
  buildOrderTitle,
  orderBlueprintCraftCount,
  resolveOrderBlueprintLines,
  resolveOrderResourceLines,
  type OrderBlueprintLine,
} from '../lib/orderPricing'
import { resourceLabelClassName, resourceQuantityUnitLabel } from '../config/resourceTypes'
import { formatQuantityForResource } from '../lib/resourceQuantity'
import type { CustomOrder } from '../lib/operations'
import type { BlueprintWithSlots } from '../lib/blueprintResources'

function formatBlueprintQuality(line: OrderBlueprintLine): string {
  const sq = line.slotQualities
  if (!sq || Object.keys(sq).length === 0) {
    return formatBlueprintOrderQualityLabel(line.minQuality)
  }
  const values = Object.values(sq).map(Number)
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return `Q${min}`
  }
  return `Q${min}–Q${max} mix`
}

function isMixedQuality(line: OrderBlueprintLine): boolean {
  const sq = line.slotQualities
  if (!sq || Object.keys(sq).length === 0) return false
  const values = Object.values(sq).map(Number)
  return values.length > 1 && Math.min(...values) !== Math.max(...values)
}

interface SlotQualityDetail {
  slotIndex: number
  slotName: string
  resourceName: string
  quality: number
}

function getSlotQualityDetails(
  line: OrderBlueprintLine,
  blueprint?: BlueprintWithSlots
): SlotQualityDetail[] {
  const sq = line.slotQualities
  if (!sq || Object.keys(sq).length === 0) return []

  return Object.entries(sq)
    .map(([idx, quality]) => {
      const slotIndex = Number(idx)
      const slot = blueprint?.slots?.[slotIndex]
      const slotName = slot?.slotDisplayName || `Slot ${slotIndex + 1}`
      const resourceName = slot?.options?.[0]?.resourceName || slot?.options?.[0]?.entityName || slot?.options?.[0]?.itemName || ''
      return { slotIndex, slotName, resourceName, quality: Number(quality) }
    })
    .sort((a, b) => a.slotIndex - b.slotIndex)
}

interface OrderRequestLinesProps {
  order: CustomOrder
  showDfp?: boolean
  blueprintById?: Map<string, BlueprintWithSlots>
}

export function orderKindLabel(order: CustomOrder): string {
  return buildOrderTitle(
    orderBlueprintCraftCount(order),
    resolveOrderResourceLines(order).length
  )
}

export default function OrderRequestLines({
  order,
  showDfp = true,
  blueprintById,
}: OrderRequestLinesProps) {
  const blueprintLines = useMemo(() => resolveOrderBlueprintLines(order), [order])
  const resourceLines = useMemo(() => resolveOrderResourceLines(order), [order])
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set())

  if (blueprintLines.length === 0 && resourceLines.length === 0) return null

  const kind = orderKindLabel(order)
  const isMixed = blueprintLines.length > 0 && resourceLines.length > 0

  const toggleExpanded = (lineKey: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev)
      if (next.has(lineKey)) {
        next.delete(lineKey)
      } else {
        next.add(lineKey)
      }
      return next
    })
  }

  return (
    <div className="space-y-1.5">
      <span
        className={`inline-block px-2 py-0.5 rounded text-[10px] border font-medium uppercase tracking-wide ${
          isMixed
            ? 'bg-amber-950/40 text-amber-200 border-amber-500/30'
            : blueprintLines.length > 0
              ? 'bg-red-950/40 text-red-200 border-red-500/30'
              : 'bg-cyan-950/40 text-cyan-200 border-cyan-500/30'
        }`}
      >
        {kind}
      </span>
      <ul className="space-y-0.5">
        {blueprintLines.map((line) => {
          const lineKey = `${order.id}-bp-${line.blueprintId}-${line.minQuality}-${line.quantity}`
          const hasMixedQuality = isMixedQuality(line)
          const isExpanded = expandedLines.has(lineKey)
          const blueprint = blueprintById?.get(line.blueprintId)
          const slotDetails = hasMixedQuality ? getSlotQualityDetails(line, blueprint) : []

          return (
            <li key={lineKey} className="text-slate-400 text-xs">
              <div className="flex flex-wrap gap-x-1.5 items-center">
                <span className="text-slate-300">{line.blueprintTitle}</span>
                <span>× {line.quantity}</span>
                <span className={hasMixedQuality ? 'text-orange-300' : ''}>
                  · {formatBlueprintQuality(line)}
                </span>
                {hasMixedQuality && slotDetails.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(lineKey)}
                    className="text-orange-400 hover:text-orange-300 text-[10px] underline"
                  >
                    {isExpanded ? 'hide' : 'details'}
                  </button>
                )}
                {showDfp && line.lineDfpAuec > 0 && (
                  <span className="text-amber-300/90">· {formatDfpAuec(line.lineDfpAuec)}</span>
                )}
              </div>
              {isExpanded && slotDetails.length > 0 && (
                <div className="mt-1 ml-3 pl-2 border-l border-orange-500/30 space-y-0.5">
                  {slotDetails.map((detail) => (
                    <div key={detail.slotIndex} className="text-[11px]">
                      <span className="text-slate-500">{detail.slotName}</span>
                      {detail.resourceName && (
                        <span className="text-slate-400"> ({detail.resourceName})</span>
                      )}
                      <span className="text-orange-300 ml-1">Q{detail.quality}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
        {resourceLines.map((line) => (
          <li
            key={`${order.id}-res-${line.resourceKey}-${line.minQuality}-${line.quantityScu}`}
            className="text-slate-400 text-xs flex flex-wrap gap-x-1.5"
          >
            <span className={resourceLabelClassName(line.resourceKey)}>{line.resourceLabel}</span>
            <span>
              · {formatQuantityForResource(line.resourceKey, line.quantityScu)}{' '}
              {resourceQuantityUnitLabel(line.resourceKey)}
            </span>
            <span>
              ·{' '}
              {formatResourceOrderQualityLabel(
                line.resourceKey,
                line.resourceLabel,
                line.minQuality
              )}
            </span>
            {showDfp && line.lineDfpAuec > 0 && (
              <span className="text-amber-300/90">· {formatDfpAuec(line.lineDfpAuec)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
