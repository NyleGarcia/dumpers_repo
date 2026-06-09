import { resourceChipClassName } from '../config/resourceTypes'
import { slugifyResourceName } from '../lib/blueprintResources'
import {
  formatTaxonomyLabel,
  getArmorSlot,
  getArmorWeight,
  getBlueprintSubType,
} from '../lib/blueprintTaxonomy'
import { formatBlueprintSpecLine } from '../lib/blueprintSpec'
import { calculateBlueprintDfp, formatCraftDfpBreakdown, formatDfpLabel } from '../lib/dfp'
import { useAuth } from '../contexts/AuthContext'

export default function BlueprintCard({
  blueprint,
  onClick,
  isAcquired,
  onToggleAcquired,
  canModify = true,
  isPending = false,
  showTargetControl = false,
  isOnTargetList = false,
  onToggleTarget,
  effectiveIsOrderable = false,
  catalogIsReward = false,
  isSuperAdmin = false,
  onToggleOrderable,
}) {
  const { dfpDisplayEnabled } = useAuth()

  if (!blueprint.file || !blueprint.blueprintName) return null

  const hasRequirements = blueprint.slots && Array.isArray(blueprint.slots) && blueprint.slots.length > 0
  const subType = getBlueprintSubType(blueprint)
  const armorWeight = getArmorWeight(blueprint)
  const armorSlot = getArmorSlot(blueprint)
  const dfp = calculateBlueprintDfp(blueprint)
  const dfpLabel = formatDfpLabel(dfp.total)
  const dfpBreakdown = formatCraftDfpBreakdown(dfp)
  const specLine = formatBlueprintSpecLine(blueprint)

  const handleCheckboxClick = (e) => {
    e.stopPropagation()
    if (canModify) {
      onToggleAcquired()
    }
  }

  const handleTargetClick = (e) => {
    e.stopPropagation()
    if (showTargetControl && onToggleTarget) {
      onToggleTarget()
    }
  }

  const handleOrderableToggle = (e) => {
    e.stopPropagation()
    if (isSuperAdmin && onToggleOrderable) {
      onToggleOrderable(!effectiveIsOrderable)
    }
  }

  const hasOverride = isSuperAdmin && effectiveIsOrderable !== catalogIsReward
  const hasCategoryTags = !!(blueprint.categoryName || subType || armorWeight || armorSlot)
  const hasRewardLabel = typeof blueprint.isReward === 'boolean' || isSuperAdmin
  const showFooter = showTargetControl || hasCategoryTags || hasRewardLabel

  return (
    <div
      onClick={() => onClick(blueprint)}
      className={`group relative min-w-0 max-w-full bg-gradient-to-br from-slate-900 to-slate-800 border rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-xl transition-all duration-200 overflow-hidden min-h-0 sm:min-h-[120px] ${
        isAcquired 
          ? 'border-green-500/50 ring-1 ring-green-500/20' 
          : 'border-slate-700 hover:border-red-500/30'
      }`}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-1">
          {dfpDisplayEnabled ? (
            <div className="shrink-0 text-left min-w-0">
              <span
                className="text-xs font-semibold text-amber-400/90 tabular-nums"
                title={dfpBreakdown}
              >
                {dfpLabel}
                <span className="text-amber-600/70 font-normal ml-0.5">aUEC</span>
              </span>
            </div>
          ) : (
            <span className="shrink-0" />
          )}
          <button
            onClick={handleCheckboxClick}
            disabled={!canModify}
            className={`ml-2 shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              isAcquired
                ? 'bg-green-500 border-green-500 text-white'
                : canModify
                  ? 'bg-transparent border-slate-500 hover:border-green-400'
                  : 'bg-transparent border-slate-600 cursor-not-allowed opacity-50'
            }`}
            title={!canModify ? (isPending ? 'Awaiting officer approval' : 'Sign in to track blueprints') : isAcquired ? 'Mark as not acquired' : 'Mark as acquired'}
          >
            {isAcquired && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        <div className="mb-3 min-w-0 text-left">
          <h3
            className="font-bold text-white line-clamp-3 text-sm leading-snug"
            title={blueprint.blueprintName}
          >
            {blueprint.blueprintName}
          </h3>
          {specLine && (
            <p className="text-xs text-slate-400 leading-snug mt-0.5 truncate">
              {specLine}
            </p>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {hasRequirements ? (
            <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800/50">
              <p className="text-slate-400 flex items-center gap-1.5 text-xs mb-2">
                <span>⏱️</span>
                <span className="font-mono">
                  <strong>{blueprint.craftTime?.hours || 0}h</strong>
                  {' '}
                  <strong>{blueprint.craftTime?.minutes || 0}m</strong>
                  {' '}
                  <strong>{blueprint.craftTime?.seconds || 0}s</strong>
                </span>
              </p>
              <div className="flex flex-wrap gap-1">
                {blueprint.slots.flatMap((slot, slotIdx) => 
                  (slot.options || []).map((opt, optIdx) => {
                    const name = opt.resourceName || opt.entityName
                    if (!name) return null
                    const chipClass = opt.type === 'item'
                      ? 'bg-purple-950/30 text-purple-400 border-purple-500/20'
                      : resourceChipClassName(slugifyResourceName(name))
                    return (
                      <span 
                        key={`${slotIdx}-${optIdx}`} 
                        className={`inline-flex items-center max-w-full px-1.5 py-0.5 rounded text-xs border break-words ${chipClass}`}
                      >
                        {name}{opt.quantity > 1 ? ` ×${opt.quantity}` : ''}
                      </span>
                    )
                  })
                ).slice(0, 6)}
                {blueprint.slots.flatMap(s => s.options || []).filter(o => o.resourceName || o.entityName).length > 6 && (
                  <span className="text-slate-500 text-xs">+{blueprint.slots.flatMap(s => s.options || []).filter(o => o.resourceName || o.entityName).length - 6} more</span>
                )}
              </div>
            </div>
          ) : null}

          {showFooter && (
            <div className="mt-3 pt-2.5 border-t border-slate-700">
              <div className="flex items-end justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1.5">
                  {hasCategoryTags && (
                    <div className="flex flex-wrap gap-1">
                      {blueprint.categoryName && (
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] border border-slate-700">
                          {blueprint.categoryName}
                        </span>
                      )}
                      {armorWeight && (
                        <span className="px-1.5 py-0.5 bg-blue-950/50 text-blue-400 rounded text-[10px] border border-blue-500/30">
                          {formatTaxonomyLabel(armorWeight)}
                        </span>
                      )}
                      {armorSlot && (
                        <span className="px-1.5 py-0.5 bg-green-950/50 text-green-400 rounded text-[10px] border border-green-500/30">
                          {formatTaxonomyLabel(armorSlot)}
                        </span>
                      )}
                      {subType && (
                        <span className="px-1.5 py-0.5 bg-orange-950/50 text-orange-400 rounded text-[10px] border border-orange-500/30">
                          {formatTaxonomyLabel(subType)}
                        </span>
                      )}
                    </div>
                  )}
                  {hasRewardLabel && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-xs text-slate-500">
                        {effectiveIsOrderable ? '★ Reward Blueprint' : '🔶 Standard'}
                      </span>
                      {hasOverride && (
                        <span className="text-[10px] text-slate-600">
                          (catalog: {catalogIsReward ? 'Reward' : 'Standard'})
                        </span>
                      )}
                      {isSuperAdmin && (
                        <label
                          className="inline-flex items-center gap-1 text-[10px] text-purple-300/90 cursor-pointer select-none"
                          onClick={handleOrderableToggle}
                        >
                          <input
                            type="checkbox"
                            checked={effectiveIsOrderable}
                            onChange={handleOrderableToggle}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/40"
                          />
                          Orderable
                        </label>
                      )}
                    </div>
                  )}
                </div>
                {showTargetControl && (
                  <button
                    onClick={handleTargetClick}
                    className={`shrink-0 px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
                      isOnTargetList
                        ? 'bg-amber-900/50 text-amber-300 border-amber-500/50 hover:bg-amber-900/70'
                        : 'bg-slate-800/80 text-slate-400 border-slate-600 hover:border-amber-500/40 hover:text-amber-300'
                    }`}
                    title={isOnTargetList ? 'Remove from target list' : 'Add to target list'}
                  >
                    {isOnTargetList ? '★ Target' : '+ Target'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
