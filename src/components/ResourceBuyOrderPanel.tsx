import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from '@tanstack/react-router'
import BlueprintTypeahead from './BlueprintTypeahead'
import BlueprintSlotQualityCard from './BlueprintSlotQualityCard'
import AuecTransferLimitModal from './AuecTransferLimitModal'
import { isSalvageResource, SALVAGE_ORDER_MIN_QUALITY } from '../config/extraResources'
import {
  isHarvestResource,
  resourceLabelClassName,
  resourceQuantityUnitLabel,
} from '../config/resourceTypes'
import { DEFAULT_STOCK_QUALITY, isNoQualityResource } from '../config/dfp'
import {
  getDefaultBandQuality,
  getResourceBands,
  getQualityTier,
  getQualityTierColor,
  PURCHASED_STOCK_QUALITY,
  supportsPurchasedQuality,
} from '../lib/qualityBands'
import {
  buildDefaultSlotQualities,
  formatSlotQualitySummary,
  isUniformSlotQuality,
  mergeSlotQualities,
} from '../lib/blueprintQuality'
import { REPUTATION_STAR_OPTIONS } from '../config/reputation'
import { exceedsSingleTransferLimit } from '../lib/auecTransferLimits'
import { getResourceLabel, type BlueprintWithSlots } from '../lib/blueprintResources'
import {
  formatDfpAuec,
  formatDfpLabel,
  formatDfpRequiredPrice,
  formatResourceOrderQualityLabel,
  isAmmoBlueprint,
} from '../lib/dfp'
import { canAddBlueprintToOrder } from '../lib/blueprintOrderable'
import {
  buildOrderFulfillmentItems,
  buildOrderTitle,
  pricingForBlueprintLine,
  pricingForResourceLine,
  resolveOrderBlueprintLines,
  resolveOrderResourceLines,
  type OrderBlueprintLine,
  type OrderResourceLine,
} from '../lib/orderPricing'
import {
  createCustomOrder,
  updateCustomOrderRequester,
  type BlueprintResourceRow,
  type CustomOrder,
} from '../lib/operations'
import ResourceQuantityInput from './ResourceQuantityInput'
import { resourceChipClassName } from '../config/resourceTypes'
import {
  formatQuantityForResource,
  parseQuantityForResource,
} from '../lib/resourceQuantity'

interface CartBlueprintLine extends OrderBlueprintLine {
  cartKey: string
  slotQualities?: Record<number, number>
}

interface CartResourceLine extends OrderResourceLine {
  cartKey: string
}

interface ResourceBuyOrderPanelProps {
  userId: string
  blueprints: BlueprintWithSlots[]
  catalog: BlueprintResourceRow[]
  labelMap: Record<string, string>
  orderOverridesMap?: Record<string, boolean>
  editOrder?: CustomOrder | null
  hasPendingBuyerRep?: boolean
  minOrderValue?: number
  initialBlueprintLines?: CartBlueprintLine[]
  blueprintOwnerCounts?: Record<string, number>
  onCancelEdit?: () => void
  onSubmitted?: () => void
  onError?: (message: string) => void
  onForceEditOrder?: (orderId: string) => void
  onDraftCleared?: () => void
}

function nextCartKey() {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatSlotQualityLabel(line: CartBlueprintLine): string {
  if (!line.slotQualities || isUniformSlotQuality(line.slotQualities)) {
    return `Q${line.minQuality}`
  }
  return formatSlotQualitySummary(line.slotQualities)
}

export default function ResourceBuyOrderPanel({
  userId,
  blueprints,
  catalog,
  labelMap,
  orderOverridesMap = {},
  editOrder,
  hasPendingBuyerRep = false,
  minOrderValue = 10000,
  initialBlueprintLines,
  blueprintOwnerCounts = {},
  onCancelEdit,
  onSubmitted,
  onError,
  onForceEditOrder,
  onDraftCleared,
}: ResourceBuyOrderPanelProps) {
  const { dfpDisplayEnabled } = useAuth()
  const isEditing = Boolean(editOrder?.id)
  const [mode, setMode] = useState<'blueprint' | 'resource'>('blueprint')
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('')
  const [bpSlotQualities, setBpSlotQualities] = useState<Record<number, number>>({})
  const [bpQty, setBpQty] = useState('1')
  const [resourceKey, setResourceKey] = useState('')
  const [resQuality, setResQuality] = useState(String(DEFAULT_STOCK_QUALITY))
  const [resQty, setResQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [minFulfillerRep, setMinFulfillerRep] = useState('')
  const [bpCart, setBpCart] = useState<CartBlueprintLine[]>([])
  const [resCart, setResCart] = useState<CartResourceLine[]>([])
  const [showNoOwnerWarning, setShowNoOwnerWarning] = useState(false)
  const [noOwnerBlueprints, setNoOwnerBlueprints] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [duplicatePendingModal, setDuplicatePendingModal] = useState<{
    show: boolean
    existingOrderId: string
  }>({ show: false, existingOrderId: '' })
  const [duplicateActiveModal, setDuplicateActiveModal] = useState<{
    show: boolean
    message: string
  }>({ show: false, message: '' })

  useEffect(() => {
    if (!editOrder) return

    setBpCart(
      resolveOrderBlueprintLines(editOrder).map((line) => ({
        ...line,
        cartKey: nextCartKey(),
      }))
    )
    setResCart(
      resolveOrderResourceLines(editOrder).map((line) => ({
        ...line,
        cartKey: nextCartKey(),
      }))
    )
    setNotes(editOrder.notes ?? '')
    setMinFulfillerRep(
      editOrder.min_fulfiller_reputation != null
        ? String(editOrder.min_fulfiller_reputation)
        : ''
    )
    setMode(
      resolveOrderBlueprintLines(editOrder).length > 0 ? 'blueprint' : 'resource'
    )
  }, [editOrder])

  // Initialize cart from draft items
  useEffect(() => {
    if (editOrder || !initialBlueprintLines || initialBlueprintLines.length === 0) return
    setBpCart(initialBlueprintLines)
    setMode('blueprint')
  }, [editOrder, initialBlueprintLines])

  const blueprintById = useMemo(() => {
    const map = new Map<string, BlueprintWithSlots>()
    blueprints.forEach((bp) => {
      if (bp.internalName) map.set(bp.internalName, bp)
    })
    return map
  }, [blueprints])

  const activeCatalog = useMemo(
    () => [...catalog].filter((r) => r.is_active).sort((a, b) => a.label.localeCompare(b.label)),
    [catalog]
  )

  const selectedBlueprint = blueprintById.get(selectedBlueprintId) ?? null
  const selectedIsAmmo = selectedBlueprint ? isAmmoBlueprint(selectedBlueprint) : false
  const selectedCanOrder = selectedBlueprint
    ? canAddBlueprintToOrder(selectedBlueprint, orderOverridesMap)
    : false

  useEffect(() => {
    if (selectedBlueprint) {
      setBpSlotQualities(buildDefaultSlotQualities(selectedBlueprint))
    } else {
      setBpSlotQualities({})
    }
  }, [selectedBlueprintId, selectedBlueprint])

  const effectiveBpSlotQualities = useMemo(() => {
    if (!selectedBlueprint) return {}
    return mergeSlotQualities(selectedBlueprint, bpSlotQualities)
  }, [selectedBlueprint, bpSlotQualities])

  const selectedBlueprintPricing = useMemo(() => {
    if (!selectedBlueprint || selectedIsAmmo) return null
    const qty = Math.max(1, Number(bpQty) || 1)
    return pricingForBlueprintLine(selectedBlueprint, effectiveBpSlotQualities, qty)
  }, [selectedBlueprint, selectedIsAmmo, effectiveBpSlotQualities, bpQty])
  const selectedResource = activeCatalog.find((r) => r.resource_key === resourceKey)
  const selectedResourceLabel = selectedResource?.label ?? ''
  const selectedResIsSalvage = selectedResource
    ? isSalvageResource(selectedResource.resource_key)
    : false
  const selectedResIsHarvest = selectedResource
    ? isHarvestResource(selectedResource.resource_key)
    : false
  const selectedResQtyUnit = selectedResource
    ? resourceQuantityUnitLabel(selectedResource.resource_key)
    : 'SCU'
  const selectedResNoQuality = selectedResource
    ? isNoQualityResource(selectedResource.resource_key)
    : false
  const resourceBands = useMemo(
    () => (resourceKey && !selectedResNoQuality ? getResourceBands(selectedResourceLabel) : undefined),
    [resourceKey, selectedResourceLabel, selectedResNoQuality]
  )

  const cartTotalDfp = useMemo(
    () =>
      bpCart.reduce((s, l) => s + l.lineDfpAuec, 0) +
      resCart.reduce((s, l) => s + l.lineDfpAuec, 0),
    [bpCart, resCart]
  )

  const fulfillmentPreview = useMemo(
    () =>
      buildOrderFulfillmentItems({
        blueprintLines: bpCart.map((line) => ({
          blueprint: blueprintById.get(line.blueprintId)!,
          quantity: line.quantity,
        })).filter((row) => row.blueprint),
        resourceLines: resCart.map((line) => ({
          resourceKey: line.resourceKey,
          quantityScu: line.quantityScu,
        })),
      }),
    [bpCart, resCart, blueprintById]
  )

  useEffect(() => {
    if (resourceKey || activeCatalog.length === 0) return
    setResourceKey(activeCatalog[0].resource_key)
  }, [activeCatalog, resourceKey])

  useEffect(() => {
    if (selectedResNoQuality) {
      setResQuality(String(SALVAGE_ORDER_MIN_QUALITY))
    } else if (resourceBands && resourceBands.length > 0) {
      setResQuality(String(getDefaultBandQuality(selectedResourceLabel)))
    } else {
      setResQuality(String(DEFAULT_STOCK_QUALITY))
    }
  }, [resourceKey, selectedResNoQuality, resourceBands, selectedResourceLabel])

  const showPurchasedQuality = selectedResource
    ? supportsPurchasedQuality(selectedResource.resource_key, selectedResourceLabel)
    : false
  const resUsesFlatBandPrice = useMemo(() => {
    if (!resourceBands || selectedResNoQuality) return false
    const q = Number(resQuality)
    if (q === PURCHASED_STOCK_QUALITY) return true
    return q === resourceBands[0]
  }, [resourceBands, resQuality, selectedResNoQuality])

  const addBlueprint = () => {
    if (!selectedBlueprint?.internalName) return
    if (!canAddBlueprintToOrder(selectedBlueprint, orderOverridesMap)) {
      onError?.('This blueprint is not available for orders')
      return
    }
    const qty = Math.max(1, Number(bpQty) || 1)
    const pricing = selectedIsAmmo
      ? pricingForBlueprintLine(selectedBlueprint, {}, qty)
      : pricingForBlueprintLine(selectedBlueprint, effectiveBpSlotQualities, qty)
    setBpCart((prev) => [
      ...prev,
      {
        cartKey: nextCartKey(),
        blueprintId: selectedBlueprint.internalName,
        blueprintTitle: selectedBlueprint.blueprintName || selectedBlueprint.internalName,
        minQuality: pricing.orderMinQuality,
        slotQualities: selectedIsAmmo ? undefined : effectiveBpSlotQualities,
        quantity: qty,
        unitDfpAuec: pricing.unitDfpAuec,
        lineDfpAuec: pricing.lineDfpAuec,
      },
    ])
    setBpQty('1')
  }

  const addResource = () => {
    if (!selectedResource) return
    const qty = parseQuantityForResource(selectedResource.resource_key, resQty)
    if (qty == null || qty <= 0) return
    const pricing = pricingForResourceLine(
      selectedResource.resource_key,
      selectedResource.label,
      Number(resQuality) || DEFAULT_STOCK_QUALITY,
      qty
    )
    setResCart((prev) => [
      ...prev,
      {
        cartKey: nextCartKey(),
        resourceKey: selectedResource.resource_key,
        resourceLabel: selectedResource.label,
        minQuality: pricing.orderMinQuality,
        quantityScu: qty,
        unitDfpAuec: pricing.unitDfpAuec,
        lineDfpAuec: pricing.lineDfpAuec,
      },
    ])
    setResQty('1')
  }

  const submitOrder = async () => {
    if (bpCart.length === 0 && resCart.length === 0) return

    setSubmitting(true)
    onError?.('')

    const payload = {
      title: buildOrderTitle(
        bpCart.reduce((sum, line) => sum + line.quantity, 0),
        resCart.length
      ),
      notes,
      totalDfpAuec: cartTotalDfp,
      minFulfillerReputation: minFulfillerRep ? Number(minFulfillerRep) : null,
      blueprints: bpCart.map((line) => ({
        blueprintId: line.blueprintId,
        blueprintTitle: line.blueprintTitle,
        minQuality: line.minQuality,
        slotQualities: line.slotQualities,
        quantity: line.quantity,
        unitDfpAuec: line.unitDfpAuec,
        lineDfpAuec: line.lineDfpAuec,
      })),
      resources: resCart.map((line) => ({
        resourceKey: line.resourceKey,
        resourceLabel: line.resourceLabel,
        minQuality: line.minQuality,
        quantityScu: line.quantityScu,
        unitDfpAuec: line.unitDfpAuec,
        lineDfpAuec: line.lineDfpAuec,
      })),
      items: fulfillmentPreview.map((item) => ({
        resourceKey: item.resourceKey,
        quantity: item.quantity,
      })),
    }

    const result = isEditing
      ? await updateCustomOrderRequester({
          orderId: editOrder!.id,
          ...payload,
          orderOverridesMap,
        })
      : await createCustomOrder({
          requesterId: userId,
          ...payload,
          orderOverridesMap,
        })

    setSubmitting(false)
    setShowTransferModal(false)

    if (result.error) {
      if (result.errorType === 'duplicate_pending' && result.existingOrderId) {
        setDuplicatePendingModal({
          show: true,
          existingOrderId: result.existingOrderId,
        })
        return
      }

      if (result.errorType === 'duplicate_active') {
        setDuplicateActiveModal({
          show: true,
          message: result.error,
        })
        return
      }

      onError?.(result.error)
      return
    }

    if (!isEditing) {
      setBpCart([])
      setResCart([])
      setNotes('')
      setMinFulfillerRep('')
      onDraftCleared?.()
    }
    onSubmitted?.()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (bpCart.length === 0 && resCart.length === 0) return

    // Check for blueprints with no owners
    const bpsWithNoOwners = bpCart
      .filter((line) => blueprintOwnerCounts[line.blueprintId] === 0)
      .map((line) => line.blueprintTitle)
    
    if (bpsWithNoOwners.length > 0 && !showNoOwnerWarning) {
      setNoOwnerBlueprints(bpsWithNoOwners)
      setShowNoOwnerWarning(true)
      return
    }

    if (exceedsSingleTransferLimit(cartTotalDfp)) {
      setShowTransferModal(true)
      return
    }
    void submitOrder()
  }

  const handleConfirmNoOwnerWarning = () => {
    setShowNoOwnerWarning(false)
    if (exceedsSingleTransferLimit(cartTotalDfp)) {
      setShowTransferModal(true)
      return
    }
    void submitOrder()
  }

  return (
    <>
      <p className="text-slate-400 text-sm mb-4">
        Build a buy order from <strong className="text-slate-300">crafted blueprints</strong>{' '}
        (full{' '}
        <a
          href="/archive#dfp"
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400/70 hover:text-orange-300 underline"
        >
          DFP
        </a>
        ) and/or <strong className="text-slate-300">refined materials</strong>{' '}
        (material-only DFP at your quality tier). Submits as a custom order — view progress on{' '}
        <Link to="/orders" className="text-red-400 hover:text-red-300">
          Custom Orders
        </Link>
        .
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2 p-1 bg-slate-900/60 border border-slate-700 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setMode('blueprint')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              mode === 'blueprint' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Add blueprint
          </button>
          <button
            type="button"
            onClick={() => setMode('resource')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              mode === 'resource' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Add resource
          </button>
        </div>

        {mode === 'blueprint' ? (
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
            <BlueprintTypeahead
              blueprints={blueprints}
              selectedBlueprint={selectedBlueprint}
              onSelect={(bp) => setSelectedBlueprintId(bp.internalName ?? '')}
              onClear={() => setSelectedBlueprintId('')}
            />
            {selectedBlueprint && (
              <>
                {selectedIsAmmo && (
                  <p className="text-slate-400 text-xs">
                    Ammo — no min quality on the order. Fulfiller may use lowest quality materials on
                    hand (in-game, ammo craft quality does not matter).
                  </p>
                )}
                {!selectedIsAmmo && selectedBlueprint.slots && selectedBlueprint.slots.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-slate-400 text-xs">Set quality per craft slot (Band 2 default).</p>
                    {selectedBlueprint.slots.map((slot, idx) => (
                      <BlueprintSlotQualityCard
                        key={idx}
                        slot={slot}
                        slotIndex={idx}
                        quality={effectiveBpSlotQualities[idx]}
                        onQualityChange={(slotIndex, quality) =>
                          setBpSlotQualities((prev) => ({ ...prev, [slotIndex]: quality }))
                        }
                        compact
                      />
                    ))}
                  </div>
                )}
                <div className={`grid gap-2 ${selectedIsAmmo ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  <input
                    type="number"
                    min={1}
                    value={bpQty}
                    onChange={(e) => setBpQty(e.target.value)}
                    placeholder="Qty"
                    className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={addBlueprint}
                    disabled={!selectedCanOrder}
                    className="py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm"
                  >
                    Add
                  </button>
                </div>
                {dfpDisplayEnabled && selectedBlueprintPricing && (
                  <p className="text-amber-200/90 text-xs">
                    Craft DFP: {formatDfpLabel(selectedBlueprintPricing.lineDfpAuec)} (
                    {formatSlotQualitySummary(effectiveBpSlotQualities)})
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
            <select
              value={resourceKey}
              onChange={(e) => setResourceKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
            >
              {activeCatalog.map((r) => (
                <option key={r.resource_key} value={r.resource_key}>
                  {r.label}
                </option>
              ))}
            </select>
            {selectedResIsSalvage && (
              <p className="text-slate-400 text-xs">
                Salvage — always Q0. No quality tier on RMC or construction material.
              </p>
            )}
            {selectedResIsHarvest && (
              <p className="text-slate-400 text-xs">
                Harvest item — whole units only. Priced by farm effort, not quality tier.
              </p>
            )}
            <div className={`grid gap-2 ${selectedResNoQuality ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {!selectedResNoQuality && (
                resourceBands ? (
                  <select
                    value={resQuality}
                    onChange={(e) => setResQuality(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                    aria-label="Quality band"
                  >
                    {showPurchasedQuality && (
                      <option value={PURCHASED_STOCK_QUALITY}>Purchased (Q0)</option>
                    )}
                    {resourceBands.map((bandValue, idx) => {
                      const tier = getQualityTier(bandValue)
                      return (
                        <option key={idx} value={bandValue} className={getQualityTierColor(tier)}>
                          Band {idx + 1}: Q{bandValue}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="range"
                      min={1}
                      max={1000}
                      step={1}
                      value={resQuality}
                      onChange={(e) => setResQuality(e.target.value)}
                      className="flex-1 min-w-0 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      aria-label="Quality slider"
                    />
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={resQuality}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        if (!isNaN(val) && val >= 1 && val <= 1000) {
                          setResQuality(String(val))
                        }
                      }}
                      className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-orange-400 font-mono text-center shrink-0"
                      aria-label="Quality value"
                    />
                  </div>
                )
              )}
              <ResourceQuantityInput
                resourceKey={selectedResource?.resource_key}
                value={resQty}
                onValueChange={setResQty}
                placeholder={selectedResQtyUnit}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm tabular-nums"
              />
              <button
                type="button"
                onClick={addResource}
                disabled={!selectedResource}
                className="py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                Add
              </button>
            </div>
            {dfpDisplayEnabled &&
              selectedResource &&
              parseQuantityForResource(selectedResource.resource_key, resQty) != null && (
              <p className="text-amber-200/90 text-xs">
                Material DFP:{' '}
                {formatDfpLabel(
                  pricingForResourceLine(
                    selectedResource.resource_key,
                    selectedResource.label,
                    Number(resQuality) || DEFAULT_STOCK_QUALITY,
                    parseQuantityForResource(selectedResource.resource_key, resQty)!
                  ).lineDfpAuec
                )}
                {selectedResNoQuality && (
                  <span className="text-slate-400"> · Base price only (Q0)</span>
                )}
                {resUsesFlatBandPrice && (
                  <span className="text-slate-400"> · Base price only (Q0 / Band 1)</span>
                )}
              </p>
            )}
          </div>
        )}

        {(bpCart.length > 0 || resCart.length > 0) && (
          <div className="border border-slate-700 rounded-xl overflow-hidden">
            <ul className="divide-y divide-slate-800">
              {bpCart.map((line) => {
                const isMixed = line.slotQualities && !isUniformSlotQuality(line.slotQualities)
                return (
                  <li
                    key={line.cartKey}
                    className="px-3 py-2 flex justify-between gap-2 text-sm bg-slate-900/40"
                  >
                    <span className="text-white flex-1 min-w-0">
                      <span className="block">{line.blueprintTitle} × {line.quantity}</span>
                      <span className={`text-xs ${isMixed ? 'text-orange-300' : 'text-slate-400'}`}>
                        {formatSlotQualityLabel(line)}
                      </span>
                    </span>
                    {dfpDisplayEnabled && (
                      <span className="text-amber-300 shrink-0">{formatDfpAuec(line.lineDfpAuec)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setBpCart((p) => p.filter((l) => l.cartKey !== line.cartKey))}
                      className="text-red-400 text-xs"
                    >
                      ×
                    </button>
                  </li>
                )
              })}
              {resCart.map((line) => (
                <li
                  key={line.cartKey}
                  className="px-3 py-2 flex justify-between gap-2 text-sm bg-slate-900/40"
                >
                  <span className="text-white">
                    <span className={resourceLabelClassName(line.resourceKey)}>
                      {line.resourceLabel}
                    </span>{' '}
                    · {formatQuantityForResource(line.resourceKey, line.quantityScu)}{' '}
                    {resourceQuantityUnitLabel(line.resourceKey)} ·{' '}
                    {formatResourceOrderQualityLabel(
                      line.resourceKey,
                      line.resourceLabel,
                      line.minQuality
                    )}
                  </span>
                  {dfpDisplayEnabled && (
                    <span className="text-amber-300 shrink-0">{formatDfpAuec(line.lineDfpAuec)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setResCart((p) => p.filter((l) => l.cartKey !== line.cartKey))}
                    className="text-red-400 text-xs"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {dfpDisplayEnabled && (
              <div className="px-3 py-3 bg-amber-950/30 border-t border-amber-500/20 flex justify-between">
                <span className="text-amber-200 text-sm font-medium">Required total (DFP)</span>
                <span className="text-amber-100 font-bold">
                  {formatDfpRequiredPrice(cartTotalDfp)}
                </span>
              </div>
            )}
          </div>
        )}

        {dfpDisplayEnabled && exceedsSingleTransferLimit(cartTotalDfp) && (
          <p className="text-orange-300/90 text-xs">
            Over 1M DFP — confirm in-game payment limits before submitting.
          </p>
        )}

        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-2">
          <label htmlFor="min-fulfiller-rep" className="text-slate-300 text-sm font-medium">
            Min fulfiller reputation
          </label>
          <p className="text-slate-500 text-xs">
            Whole-number minimum (1–5) after fulfillers have 5+ completed jobs. Unrated fulfillers
            are always eligible — they must be given a chance.
          </p>
          <select
            id="min-fulfiller-rep"
            value={minFulfillerRep}
            onChange={(e) => setMinFulfillerRep(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
          >
            <option value="">No minimum</option>
            {REPUTATION_STAR_OPTIONS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}+ stars
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
        />

        {fulfillmentPreview.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fulfillmentPreview.map((item) => (
              <span
                key={item.resourceKey}
                className={`px-2 py-1 text-xs rounded border ${resourceChipClassName(item.resourceKey)}`}
              >
                {getResourceLabel(item.resourceKey, labelMap)} ×{' '}
                {formatQuantityForResource(item.resourceKey, item.quantity)}
              </span>
            ))}
          </div>
        )}

        {hasPendingBuyerRep && !isEditing && cartTotalDfp > 0 && cartTotalDfp < minOrderValue && (
          <div className="p-3 bg-yellow-900/30 border border-yellow-600/40 rounded-lg">
            <p className="text-yellow-300 text-sm">
              <strong>Minimum order value:</strong> While building your reputation, orders must be at
              least {formatDfpAuec(minOrderValue)}. Current total: {formatDfpAuec(cartTotalDfp)}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={
              submitting ||
              (bpCart.length === 0 && resCart.length === 0) ||
              (hasPendingBuyerRep && !isEditing && cartTotalDfp < minOrderValue)
            }
            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {submitting
              ? 'Saving...'
              : isEditing
                ? dfpDisplayEnabled
                  ? `Save changes · ${formatDfpAuec(cartTotalDfp)}`
                  : 'Save changes'
                : dfpDisplayEnabled
                  ? `Submit buy order · ${formatDfpAuec(cartTotalDfp)}`
                  : 'Submit buy order'}
          </button>
          {isEditing && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-sm"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {showTransferModal && (
        <AuecTransferLimitModal
          totalAuec={cartTotalDfp}
          onConfirm={() => void submitOrder()}
          onCancel={() => setShowTransferModal(false)}
          confirming={submitting}
        />
      )}

      {showNoOwnerWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <span>⚠️</span> No Owners Found
            </h3>
            <p className="text-slate-300 mb-3">
              The following blueprint{noOwnerBlueprints.length > 1 ? 's have' : ' has'} not been acquired by any members yet:
            </p>
            <ul className="mb-4 space-y-1">
              {noOwnerBlueprints.map((title, i) => (
                <li key={i} className="text-amber-300 text-sm pl-4">• {title}</li>
              ))}
            </ul>
            <p className="text-slate-400 text-sm mb-4">
              This order may take longer to fulfill since no one currently owns {noOwnerBlueprints.length > 1 ? 'these blueprints' : 'this blueprint'}.
              Consider creating separate orders for easier items.
            </p>
            <a
              href="/archive#ordering-tips"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 text-sm underline mb-6 inline-block"
            >
              View ordering best practices
            </a>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNoOwnerWarning(false)}
                className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmNoOwnerWarning}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicatePendingModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-orange-500/40 rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">Existing Order Found</h3>
            <p className="text-slate-300 mb-6">
              Pending order found with same Blueprint. Pulling your existing order back for editing.
            </p>
            <button
              onClick={() => {
                setDuplicatePendingModal({ show: false, existingOrderId: '' })
                onForceEditOrder?.(duplicatePendingModal.existingOrderId)
              }}
              className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {duplicateActiveModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/40 rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-red-400 mb-3">Order Blocked</h3>
            <p className="text-slate-300 mb-6">{duplicateActiveModal.message}</p>
            <button
              onClick={() => setDuplicateActiveModal({ show: false, message: '' })}
              className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )
}
