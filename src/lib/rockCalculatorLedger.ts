import { getResourceType } from '../config/resourceTypes'
import type { BlueprintResourceRow } from './operations'
import {
  mergeMiningRowsByResourceQuality,
  newLedgerRowId,
  roundLedgerCscu,
  type MiningLedgerMiningRow,
} from './miningLedger'
import { resolveLedgerQuality } from './qualityBands'
import { fetchMiningLedger, updateMiningLedger } from './miningLedgerOps'
import { oreResourceKeyFromElementName, isInertElement } from './rockCalculator'

export interface CalculatorLedgerMaterialInput {
  elementName: string
  scu: number
  percent: number
  quality: number
}

function oreCatalogEntries(catalog: BlueprintResourceRow[]): BlueprintResourceRow[] {
  return catalog.filter((row) => {
    const type = getResourceType(row.resource_key)
    return type === 'ore' || type === 'gem'
  })
}

export function resolveOreResourceKey(
  elementName: string,
  catalog: BlueprintResourceRow[]
): { resourceKey: string; resourceLabel: string } {
  const slug = oreResourceKeyFromElementName(elementName)
  const bySlug = catalog.find((row) => row.resource_key === slug)
  if (bySlug) return { resourceKey: bySlug.resource_key, resourceLabel: bySlug.label }

  const byLabel = catalog.find(
    (row) => row.label.toLowerCase() === elementName.trim().toLowerCase()
  )
  if (byLabel) return { resourceKey: byLabel.resource_key, resourceLabel: byLabel.label }

  return { resourceKey: slug, resourceLabel: elementName }
}

export function buildCalculatorLedgerRows(
  materials: CalculatorLedgerMaterialInput[],
  catalog: BlueprintResourceRow[]
): MiningLedgerMiningRow[] {
  const oreCatalog = oreCatalogEntries(catalog)

  return materials
    .filter(
      (material) =>
        !isInertElement(material.elementName) && material.percent > 0 && material.scu > 0
    )
    .map((material) => {
      const { resourceKey, resourceLabel } = resolveOreResourceKey(
        material.elementName,
        oreCatalog
      )
      return {
        id: newLedgerRowId(),
        resourceKey,
        resourceLabel,
        quality: resolveLedgerQuality(resourceKey, resourceLabel, material.quality),
        unrefinedCscu: roundLedgerCscu(material.scu),
        yieldActual: null,
      }
    })
}

export function formatCalculatorLedgerMergeMessage(
  mergedCount: number,
  addedCount: number
): string {
  const parts: string[] = []
  if (mergedCount > 0) {
    parts.push(`merged ${mergedCount} row${mergedCount === 1 ? '' : 's'}`)
  }
  if (addedCount > 0) {
    parts.push(`added ${addedCount} new row${addedCount === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) return 'No rows updated'
  const message = parts.join(', ')
  return message.charAt(0).toUpperCase() + message.slice(1)
}

export async function appendCalculatorRowsToLedger(
  ledgerId: string,
  rows: MiningLedgerMiningRow[]
): Promise<{ error: string | null; mergedCount: number; addedCount: number }> {
  if (rows.length === 0) {
    return { error: 'Enter at least one material percentage to add.', mergedCount: 0, addedCount: 0 }
  }

  const { data: ledger, error: loadError } = await fetchMiningLedger(ledgerId)
  if (loadError || !ledger) {
    return { error: loadError ?? 'Failed to load ledger', mergedCount: 0, addedCount: 0 }
  }

  const { miningRows, mergedCount, addedCount } = mergeMiningRowsByResourceQuality(
    ledger.data.miningRows,
    rows
  )

  const { error: saveError } = await updateMiningLedger(ledgerId, {
    data: {
      ...ledger.data,
      miningRows,
    },
  })

  if (saveError) return { error: saveError, mergedCount: 0, addedCount: 0 }
  return { error: null, mergedCount, addedCount }
}
