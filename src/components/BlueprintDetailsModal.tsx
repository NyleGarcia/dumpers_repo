import React, { useState, useMemo, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { type BlueprintWithSlots } from '../lib/blueprintResources'
import {
  calculateSlotModifiers,
  aggregateModifiers,
  formatModifierPercent,
  getModifierColorClass,
  formatStatValue,
  getPropertyLabel,
} from '../lib/qualityModifiers'
import {
  buildDefaultSlotQualities,
  formatSlotQualitySummary,
  isUniformSlotQuality,
  mergeSlotQualities,
  minSlotQuality,
} from '../lib/blueprintQuality'
import { pricingForBlueprintLine } from '../lib/orderPricing'
import { formatDfpAuec } from '../lib/dfp'
import { useOrderDraft } from '../contexts/OrderDraftContext'
import BlueprintSlotQualityCard from './BlueprintSlotQualityCard'
import AppModal from './layout/AppModal'

interface SlotOption {
  type?: string
  resourceName?: string
  entityName?: string
  displayName?: string
  itemName?: string
  quantity?: number
  standardCargoUnits?: number
  minQuality?: number
  modifiers?: Array<{
    gameplayProperty?: string
    property?: string
    startQuality?: number
    endQuality?: number
    modifierAtStart?: number
    modifierAtEnd?: number
    baseAmount?: number
    perQuality?: number
  }>
}

interface BlueprintSlot {
  slotDisplayName?: string
  slotDebugName?: string
  requiredCount?: number
  options?: SlotOption[]
}

interface BlueprintRecord {
  file: string
  internalName?: string
  blueprintName?: string
  categoryName?: string
  isReward?: boolean
  craftTime?: { hours?: number; minutes?: number; seconds?: number }
  slots?: BlueprintSlot[]
  rewardMissions?: unknown[]
  vehicleBaseStats?: Record<string, number | null>
  armorBaseStats?: Record<string, number | null>
  weaponBaseStats?: Record<string, number | null>
}

interface BlueprintDetailsModalProps {
  blueprint: BlueprintRecord
  subTypeLabel?: string | null
  onClose: () => void
  isApproved: boolean
  isGuest?: boolean
  isAcquired: boolean
  isOnTarget: boolean
  effectiveIsOrderable?: boolean
  canAddToTargetList?: boolean
  onToggleTarget?: () => void
  canAddToOrder?: boolean
  ownerCount?: number
}

export default function BlueprintDetailsModal({
  blueprint,
  subTypeLabel,
  onClose,
  isApproved,
  isGuest = false,
  isAcquired,
  isOnTarget,
  effectiveIsOrderable = false,
  canAddToTargetList = false,
  onToggleTarget,
  canAddToOrder = false,
  ownerCount,
}: BlueprintDetailsModalProps) {
  // Track quality for each slot (indexed by slot position)
  const [slotQualities, setSlotQualities] = useState<Record<number, number>>({})
  const [addedToOrder, setAddedToOrder] = useState(false)
  const { addToDraft, draftCount } = useOrderDraft()

  const blueprintWithSlots = blueprint as BlueprintWithSlots

  useEffect(() => {
    setSlotQualities(buildDefaultSlotQualities(blueprintWithSlots))
  }, [blueprint.internalName])

  const effectiveSlotQualities = useMemo(
    () => mergeSlotQualities(blueprintWithSlots, slotQualities),
    [blueprintWithSlots, slotQualities]
  )

  // Check if any slot has modifiers
  const hasModifiers = useMemo(() => {
    return blueprint.slots?.some(slot =>
      slot.options?.some(opt => opt.modifiers && opt.modifiers.length > 0)
    ) ?? false
  }, [blueprint.slots])

  // Merge all base stats (vehicle, armor, weapon) into one object, filtering out nulls
  const mergedBaseStats = useMemo(() => {
    const stats: Record<string, number> = {}
    const allStats = {
      ...blueprint.vehicleBaseStats,
      ...blueprint.armorBaseStats,
      ...blueprint.weaponBaseStats,
    }
    for (const [key, value] of Object.entries(allStats)) {
      if (value !== null && value !== undefined) {
        stats[key] = value
      }
    }
    return stats
  }, [blueprint.vehicleBaseStats, blueprint.armorBaseStats, blueprint.weaponBaseStats])

  // Calculate modifiers for all slots based on current quality settings
  const allSlotModifiers = useMemo(() => {
    if (!blueprint.slots) return []
    
    return blueprint.slots.map((slot, idx) => {
      const quality = effectiveSlotQualities[idx] ?? buildDefaultSlotQualities(blueprintWithSlots)[idx]
      const modifiers = slot.options?.[0]?.modifiers
      return calculateSlotModifiers(quality, modifiers)
    })
  }, [blueprint.slots, effectiveSlotQualities, blueprintWithSlots])

  // Aggregate all modifiers across slots
  const aggregatedModifiers = useMemo(() => {
    if (!hasModifiers) return []
    return aggregateModifiers(allSlotModifiers, mergedBaseStats)
  }, [allSlotModifiers, mergedBaseStats, hasModifiers])

  const handleQualityChange = (slotIndex: number, quality: number) => {
    setSlotQualities(prev => ({ ...prev, [slotIndex]: quality }))
  }

  const minSlotQualityValue = useMemo(
    () => minSlotQuality(effectiveSlotQualities),
    [effectiveSlotQualities]
  )

  const isUniformQuality = useMemo(
    () => isUniformSlotQuality(effectiveSlotQualities),
    [effectiveSlotQualities]
  )

  const orderPricing = useMemo(() => {
    if (!canAddToOrder) return null
    return pricingForBlueprintLine(blueprintWithSlots, effectiveSlotQualities, 1)
  }, [blueprintWithSlots, effectiveSlotQualities, canAddToOrder])

  const handleAddToOrder = () => {
    if (!orderPricing || !canAddToOrder) return

    addToDraft({
      blueprintId: blueprint.internalName,
      blueprintTitle: blueprint.blueprintName || blueprint.internalName,
      slotQualities: effectiveSlotQualities,
      quantity: 1,
      unitDfpAuec: orderPricing.unitDfpAuec,
      lineDfpAuec: orderPricing.lineDfpAuec,
    })

    setAddedToOrder(true)
    setTimeout(() => setAddedToOrder(false), 3000)
  }

  return (
    <AppModal
      title={blueprint.blueprintName || 'Blueprint'}
      onClose={onClose}
      size="lg"
      zIndex={60}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300">
            {blueprint.categoryName || 'Unknown'}
          </span>
          {subTypeLabel && (
            <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300">{subTypeLabel}</span>
          )}
          {effectiveIsOrderable ? (
            <span className="px-2.5 py-1 bg-amber-900/50 text-amber-400 rounded-lg">★ Reward</span>
          ) : (
            <span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg">🔶 Standard</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4">
            <h3 className="text-slate-400 text-sm mb-2">Craft Time</h3>
            <p className="text-white text-base font-mono">
              {blueprint.craftTime?.hours || 0}h {blueprint.craftTime?.minutes || 0}m{' '}
              {blueprint.craftTime?.seconds || 0}s
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4">
            <h3 className="text-slate-400 text-sm mb-2">Members Own</h3>
            {ownerCount !== undefined ? (
              <p className={`text-base font-semibold ${ownerCount === 0 ? 'text-amber-400' : 'text-white'}`}>
                {ownerCount === 0 ? 'None yet' : ownerCount.toLocaleString()}
              </p>
            ) : (
              <p className="text-slate-500 text-base">—</p>
            )}
            {ownerCount === 0 && (
              <p className="text-amber-400/70 text-xs mt-1">Orders may take longer</p>
            )}
          </div>
        </div>

        {/* Display base stats for components (mining lasers, etc.) */}
        {Object.keys(mergedBaseStats).length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4">
            <h3 className="text-slate-400 text-sm mb-3">Base Specifications</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(mergedBaseStats).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">{getPropertyLabel(key)}</span>
                  <span className="text-white font-mono">{formatStatValue(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {blueprint.slots && blueprint.slots.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4">
            <h3 className="text-slate-400 text-sm mb-3">Required Resources</h3>
            <div className="space-y-3">
              {blueprint.slots.map((slot, idx) => (
                <BlueprintSlotQualityCard
                  key={idx}
                  slot={slot}
                  slotIndex={idx}
                  quality={effectiveSlotQualities[idx]}
                  onQualityChange={handleQualityChange}
                  modifierResults={allSlotModifiers[idx] ?? []}
                />
              ))}
            </div>
          </div>
        )}

        {hasModifiers && aggregatedModifiers.length > 0 && (
          <CombinedModifiersSection modifiers={aggregatedModifiers} />
        )}

        {blueprint.rewardMissions && blueprint.rewardMissions.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-500/25 rounded-xl p-3 sm:p-4">
            <h3 className="text-amber-300/90 text-sm font-semibold mb-2">
              Reward Missions ({blueprint.rewardMissions.length})
            </h3>
            {!isApproved && !isGuest ? (
              <p className="text-sm text-slate-400">
                After your account is approved, add this blueprint to your Mission Tracker to track which
                missions reward it.
              </p>
            ) : isAcquired ? (
              <p className="text-sm text-slate-400">
                This blueprint is already in your pool. Reward missions are only tracked in Mission Tracker
                while you are still hunting a blueprint.
              </p>
            ) : isOnTarget ? (
              <p className="text-sm text-slate-400">
                This blueprint is tracked. Open{' '}
                <strong className="text-amber-300/90">Mission Tracker</strong> from the menu to see grouped
                missions, toggle them on/off, and track progress.
              </p>
            ) : !canAddToTargetList ? (
              <p className="text-sm text-slate-400">
                This blueprint cannot be tracked (no reward missions to track).
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={onToggleTarget}
                  className="text-xs font-semibold uppercase px-2 py-1 rounded transition-colors bg-orange-600/30 text-orange-300 hover:bg-orange-600/40"
                >
                  Track
                </button>
                <span className="text-sm text-slate-400">Click to add to Mission Tracker</span>
              </div>
            )}
          </div>
        )}

        {canAddToOrder && orderPricing && (
          <div className="bg-red-950/20 border border-red-500/25 rounded-xl p-3 sm:p-4">
            <h3 className="text-red-300/90 text-sm font-semibold mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Add to Order
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-400">Quality:</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded text-orange-300 font-mono">
                  {formatSlotQualitySummary(effectiveSlotQualities)}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-amber-300 font-medium">
                  {formatDfpAuec(orderPricing.unitDfpAuec)}
                </span>
                <a
                  href="/archive#dfp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-orange-400 transition-colors"
                  title="What is DFP?"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </a>
              </div>
              {!isUniformQuality && (
                <p className="text-xs text-slate-500">
                  Mixed quality — DFP prices each slot at its selected band. Minimum Q
                  {minSlotQualityValue} is the fulfiller matching floor.
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddToOrder}
                  disabled={addedToOrder}
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                    addedToOrder
                      ? 'bg-green-600/30 text-green-300 cursor-default'
                      : 'bg-red-600/30 text-red-300 hover:bg-red-600/40'
                  }`}
                >
                  {addedToOrder ? '✓ Added!' : 'Add to Order'}
                </button>
                {draftCount > 0 && (
                  <Link
                    to="/orders"
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    {draftCount} item{draftCount !== 1 ? 's' : ''} in draft →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  )
}

interface CombinedModifiersSectionProps {
  modifiers: ReturnType<typeof aggregateModifiers>
}

function CombinedModifiersSection({ modifiers }: CombinedModifiersSectionProps) {
  if (modifiers.length === 0) return null

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-orange-900/20 rounded-xl p-3 sm:p-4 border border-orange-500/20">
      <h3 className="text-orange-300 text-sm font-semibold mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Final Combined Modifiers
      </h3>
      
      <div className="space-y-2">
        {modifiers.map((mod, idx) => (
          <div
            key={idx}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1.5 border-b border-slate-700/30 last:border-0"
          >
            <span className="text-slate-300 text-sm font-medium">{mod.propertyLabel}</span>
            <div className="flex items-center gap-3 text-xs">
              {mod.baseValue !== undefined && mod.finalValue !== undefined && (
                <span className="text-slate-500">
                  {formatStatValue(mod.baseValue)} → {' '}
                  <span className={getModifierColorClass(mod.combinedModifier, mod.property)}>
                    {formatStatValue(mod.finalValue)}
                  </span>
                </span>
              )}
              <span className={`font-mono font-semibold ${getModifierColorClass(mod.combinedModifier, mod.property)}`}>
                {formatModifierPercent(mod.combinedModifier)}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-[10px] text-slate-500 mt-3">
        Select quality bands (for known resources) or adjust sliders to simulate different resource qualities.
      </p>
    </div>
  )
}
