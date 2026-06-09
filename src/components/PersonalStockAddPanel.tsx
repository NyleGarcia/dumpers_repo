import React, { useEffect, useMemo, useState } from 'react'
import { SALVAGE_ORDER_MIN_QUALITY } from '../config/extraResources'
import { DEFAULT_STOCK_QUALITY, stockQualityTiersForResource } from '../config/dfp'
import {
  isHarvestResource,
  resourceLabelClassName,
  resourceQuantityUnitLabel,
} from '../config/resourceTypes'
import { getResourceLabel } from '../lib/blueprintResources'
import { addPersonalInventoryLine, type BlueprintResourceRow } from '../lib/operations'
import ResourceQuantityInput from './ResourceQuantityInput'
import {
  formatQuantityForResource,
  parseQuantityForResource,
} from '../lib/resourceQuantity'

interface PersonalStockAddPanelProps {
  userId: string
  catalog: BlueprintResourceRow[]
  labelMap: Record<string, string>
  existingKeys: Set<string>
  onAdded: () => void
  onError?: (message: string) => void
}

export default function PersonalStockAddPanel({
  userId,
  catalog,
  labelMap,
  existingKeys,
  onAdded,
  onError,
}: PersonalStockAddPanelProps) {
  const [search, setSearch] = useState('')
  const [resourceKey, setResourceKey] = useState('')
  const [quality, setQuality] = useState(String(DEFAULT_STOCK_QUALITY))
  const [quantity, setQuantity] = useState('0')
  const [submitting, setSubmitting] = useState(false)

  const activeCatalog = useMemo(
    () => [...catalog].filter((r) => r.is_active).sort((a, b) => a.label.localeCompare(b.label)),
    [catalog]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeCatalog.slice(0, 60)
    return activeCatalog
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.resource_key.toLowerCase().includes(q)
      )
      .slice(0, 60)
  }, [activeCatalog, search])

  const selectedLabel = resourceKey ? getResourceLabel(resourceKey, labelMap) : ''
  const qualityTiers = useMemo(
    () => stockQualityTiersForResource(resourceKey, selectedLabel),
    [resourceKey, selectedLabel]
  )
  const selectedIsSalvage = qualityTiers.length === 1 && qualityTiers[0] === SALVAGE_ORDER_MIN_QUALITY
  const selectedIsHarvest = resourceKey ? isHarvestResource(resourceKey) : false
  const qtyUnit = resourceKey ? resourceQuantityUnitLabel(resourceKey) : 'SCU'

  useEffect(() => {
    if (selectedIsSalvage) setQuality(String(SALVAGE_ORDER_MIN_QUALITY))
  }, [resourceKey, selectedIsSalvage])

  const lineKey = resourceKey && quality ? `${resourceKey}::${quality}` : ''
  const lineExists = lineKey ? existingKeys.has(lineKey) : false

  const handleAdd = async () => {
    const qty = parseQuantityForResource(resourceKey, quantity)
    if (!resourceKey || qty == null || qty <= 0) {
      onError?.('Pick a resource, quality tier, and quantity greater than 0')
      return
    }

    setSubmitting(true)
    onError?.('')

    const result = await addPersonalInventoryLine({
      userId,
      resourceKey,
      quality: Number(quality),
      quantityScu: qty,
    })

    setSubmitting(false)

    if (result.error) {
      onError?.(result.error)
      return
    }

    setQuantity('0')
    onAdded()
  }

  return (
    <div className="w-full min-w-0 bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3 overflow-hidden">
      <div>
        <h2 className="text-white font-medium text-sm">Add material stock</h2>
        <p className="text-slate-500 text-xs mt-1">
          Create a card per resource and quality tier — Q0 for store-bought and salvage (RMC,
          construction material), Q100–Q1000 for mined/refined ore. Use the buttons on each card to
          adjust in-game.
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search catalog to add..."
        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 min-w-0">
        <select
          value={resourceKey}
          onChange={(e) => setResourceKey(e.target.value)}
          className="sm:col-span-2 w-full min-w-0 max-w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm truncate"
        >
          <option value="">Select resource</option>
          {filtered.map((r) => (
            <option key={r.resource_key} value={r.resource_key}>
              {r.label}
            </option>
          ))}
        </select>

        {selectedIsSalvage ? (
          <div className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 text-sm">
            Q0 (salvage)
          </div>
        ) : (
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
            aria-label="Quality tier"
          >
            {qualityTiers.map((tier) => (
              <option key={tier} value={tier}>
                Q{tier}
              </option>
            ))}
          </select>
        )}

        <ResourceQuantityInput
          resourceKey={resourceKey || undefined}
          value={quantity}
          onValueChange={setQuantity}
          placeholder={qtyUnit}
          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm tabular-nums"
        />
      </div>

      {resourceKey && (
        <p className="text-slate-400 text-xs">
          <span className={resourceKey ? resourceLabelClassName(resourceKey) : ''}>
            {selectedLabel}
          </span>{' '}
          ·{' '}
          {selectedIsSalvage
            ? 'Q0 (salvage)'
            : selectedIsHarvest
              ? 'Harvest'
              : `Q${quality}`}
          {lineExists
            ? ' — adds to your existing card'
            : ' — creates a new card'}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={submitting || !resourceKey}
        className="w-full max-w-full px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium truncate"
      >
        {submitting
          ? 'Adding...'
          : lineExists
            ? `Add ${formatQuantityForResource(resourceKey, parseQuantityForResource(resourceKey, quantity) ?? 0)} ${qtyUnit} to card`
            : 'Create stock card'}
      </button>
    </div>
  )
}
