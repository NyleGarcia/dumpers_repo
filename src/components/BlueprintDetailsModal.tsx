import React, { useState, useMemo } from 'react'
import { resourceLabelClassName } from '../config/resourceTypes'
import { slugifyResourceName } from '../lib/blueprintResources'
import {
  Modifier,
  calculateSlotModifiers,
  aggregateModifiers,
  formatModifierPercent,
  getModifierColorClass,
  formatStatValue,
  SlotModifierResult,
} from '../lib/qualityModifiers'
import AppModal from './layout/AppModal'

interface SlotOption {
  type?: string
  resourceName?: string
  entityName?: string
  quantity?: number
  standardCargoUnits?: number
  minQuality?: number
  modifiers?: Modifier[]
}

interface BlueprintSlot {
  slotDisplayName?: string
  slotDebugName?: string
  requiredCount?: number
  options?: SlotOption[]
}

interface BlueprintRecord {
  file: string
  blueprintName?: string
  categoryName?: string
  isReward?: boolean
  craftTime?: { hours?: number; minutes?: number; seconds?: number }
  slots?: BlueprintSlot[]
  rewardMissions?: unknown[]
  vehicleBaseStats?: Record<string, number>
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
}: BlueprintDetailsModalProps) {
  // Track quality for each slot (indexed by slot position)
  const [slotQualities, setSlotQualities] = useState<Record<number, number>>({})

  // Check if any slot has modifiers
  const hasModifiers = useMemo(() => {
    return blueprint.slots?.some(slot =>
      slot.options?.some(opt => opt.modifiers && opt.modifiers.length > 0)
    ) ?? false
  }, [blueprint.slots])

  // Calculate modifiers for all slots based on current quality settings
  const allSlotModifiers = useMemo(() => {
    if (!blueprint.slots) return []
    
    return blueprint.slots.map((slot, idx) => {
      const quality = slotQualities[idx] ?? 1
      const modifiers = slot.options?.[0]?.modifiers
      return calculateSlotModifiers(quality, modifiers)
    })
  }, [blueprint.slots, slotQualities])

  // Aggregate all modifiers across slots
  const aggregatedModifiers = useMemo(() => {
    if (!hasModifiers) return []
    return aggregateModifiers(allSlotModifiers, blueprint.vehicleBaseStats)
  }, [allSlotModifiers, blueprint.vehicleBaseStats, hasModifiers])

  const handleQualityChange = (slotIndex: number, quality: number) => {
    setSlotQualities(prev => ({ ...prev, [slotIndex]: quality }))
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

        <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4">
          <h3 className="text-slate-400 text-sm mb-2">Craft Time</h3>
          <p className="text-white text-base font-mono">
            {blueprint.craftTime?.hours || 0}h {blueprint.craftTime?.minutes || 0}m{' '}
            {blueprint.craftTime?.seconds || 0}s
          </p>
        </div>

        {blueprint.slots && blueprint.slots.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4">
            <h3 className="text-slate-400 text-sm mb-3">Required Resources</h3>
            <div className="space-y-3">
              {blueprint.slots.map((slot, idx) => (
                <ResourceSlotCard
                  key={idx}
                  slot={slot}
                  slotIndex={idx}
                  quality={slotQualities[idx] ?? 1}
                  onQualityChange={handleQualityChange}
                  modifierResults={allSlotModifiers[idx] ?? []}
                />
              ))}
            </div>
          </div>
        )}

        {hasModifiers && aggregatedModifiers.length > 0 && (
          <CombinedModifiersSection
            modifiers={aggregatedModifiers}
            baseStats={blueprint.vehicleBaseStats}
          />
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
      </div>
    </AppModal>
  )
}

interface ResourceSlotCardProps {
  slot: BlueprintSlot
  slotIndex: number
  quality: number
  onQualityChange: (slotIndex: number, quality: number) => void
  modifierResults: SlotModifierResult[]
}

function ResourceSlotCard({
  slot,
  slotIndex,
  quality,
  onQualityChange,
  modifierResults,
}: ResourceSlotCardProps) {
  const hasModifiers = modifierResults.length > 0
  const option = slot.options?.[0]

  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
      <div className="flex justify-between items-center gap-2 mb-2">
        <span className="text-white font-medium text-sm">{slot.slotDisplayName}</span>
        <span className="text-slate-400 text-sm shrink-0">×{slot.requiredCount || 1}</span>
      </div>
      
      {slot.options && slot.options.length > 0 && (
        <div className="space-y-2">
          {slot.options.map((opt, optIdx) => {
            const name = opt.resourceName || opt.entityName || 'Unknown'
            const resourceKey = slugifyResourceName(name)
            const isItem = opt.type === 'item'
            const labelClass = isItem ? 'text-purple-400' : resourceLabelClassName(resourceKey)
            return (
              <div key={optIdx} className="flex justify-between gap-2 text-sm min-w-0">
                <span className={`min-w-0 break-words ${labelClass}`}>{name}</span>
                {(opt.standardCargoUnits ?? 0) > 0 ? (
                  <span className="text-slate-500 shrink-0">{opt.standardCargoUnits} SCU</span>
                ) : (opt.quantity ?? 0) > 0 ? (
                  <span className="text-slate-500 shrink-0">×{opt.quantity}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {hasModifiers && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-3 mb-2">
            <label className="text-xs text-slate-500 uppercase tracking-wide shrink-0">
              Quality
            </label>
            <input
              type="range"
              min={1}
              max={1000}
              step={1}
              value={quality}
              onChange={(e) => onQualityChange(slotIndex, parseInt(e.target.value, 10))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <input
              type="number"
              min={1}
              max={1000}
              value={quality}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) onQualityChange(slotIndex, Math.max(1, Math.min(1000, val)))
              }}
              className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-right text-orange-400 font-mono"
            />
          </div>
          
          <div className="space-y-1">
            {modifierResults.map((result, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{result.propertyLabel}</span>
                <span className={getModifierColorClass(result.modifier)}>
                  {formatModifierPercent(result.modifier)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface CombinedModifiersSectionProps {
  modifiers: ReturnType<typeof aggregateModifiers>
  baseStats?: Record<string, number>
}

function CombinedModifiersSection({ modifiers, baseStats }: CombinedModifiersSectionProps) {
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
                  <span className={getModifierColorClass(mod.combinedModifier)}>
                    {formatStatValue(mod.finalValue)}
                  </span>
                </span>
              )}
              <span className={`font-mono font-semibold ${getModifierColorClass(mod.combinedModifier)}`}>
                {formatModifierPercent(mod.combinedModifier)}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-[10px] text-slate-500 mt-3">
        Adjust quality sliders above to simulate different resource qualities.
      </p>
    </div>
  )
}
