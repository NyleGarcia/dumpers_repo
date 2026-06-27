import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ORE_SIGNATURES } from '../../lib/miningConstants'
import {
  depositTypeLabel,
  getDepositTypes,
  getRockCompositionProfile,
  type DepositType,
  type ProfileMode,
} from '../../lib/miningClusterProfiles'
import { normalizeMiningOreName } from '../../lib/handMineables'
import type { MiningTrackerEntry } from '../../lib/localGuestCache'
import {
  buildDefaultPercentSlots,
  calculateMaterialDfpValue,
  calculateMaterialScu,
  compositionSlotKey,
  formatCompositionRangeHint,
  formatCompositionRowLabel,
  formatMaterialScu,
  formatRockDfpValue,
  isPercentOverLimit,
  parsePercentInput,
  parseTotalScuInput,
  sumPercentages,
} from '../../lib/rockCalculator'

const RS_ORE_NAMES = [...new Set(Object.keys(ORE_SIGNATURES).map(normalizeMiningOreName))].sort(
  (a, b) => a.localeCompare(b)
)

function searchRsOres(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return RS_ORE_NAMES.slice(0, 20)
  return RS_ORE_NAMES.filter((name) => name.toLowerCase().includes(q)).slice(0, 20)
}

interface RockCalculatorProps {
  loadEntry: MiningTrackerEntry | null
  loadToken: number
}

export default function RockCalculator({ loadEntry, loadToken }: RockCalculatorProps) {
  const [oreName, setOreName] = useState('')
  const [depositType, setDepositType] = useState<DepositType>('asteroid')
  const [profileMode, setProfileMode] = useState<ProfileMode>('overall')
  const [locationName, setLocationName] = useState<string | undefined>(undefined)
  const [totalScuInput, setTotalScuInput] = useState('')
  const [percentBySlot, setPercentBySlot] = useState<Record<string, string>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loadEntry) return
    const entryDeposit: DepositType =
      loadEntry.depositType === 'asteroid' ? 'asteroid' : 'surface'
    setOreName(loadEntry.oreName)
    setDepositType(entryDeposit)
    setProfileMode(loadEntry.profileMode)
    setLocationName(loadEntry.locationName)
    setSearchQuery(loadEntry.oreName)
    setTotalScuInput('')
  }, [loadEntry, loadToken])

  const searchOptions = useMemo(() => searchRsOres(searchQuery), [searchQuery])

  useEffect(() => {
    if (searchFocused && searchRef.current && document.activeElement === searchRef.current) {
      if (searchOptions.length > 0) setSearchOpen(true)
    }
  }, [searchOptions, searchFocused])

  const availableDepositTypes = useMemo(
    () => (oreName ? getDepositTypes(oreName) : []),
    [oreName]
  )

  const composition = useMemo(() => {
    if (!oreName) return null
    return getRockCompositionProfile(oreName, depositType, {
      profileMode,
      locationName,
    })
  }, [oreName, depositType, profileMode, locationName])

  const compositionKey = useMemo(() => {
    if (!composition?.compositionParts.length) return null
    return [
      oreName,
      depositType,
      profileMode,
      locationName ?? '',
      composition.compositionParts.map((p) => p.elementName).join('|'),
    ].join(':')
  }, [composition, oreName, depositType, profileMode, locationName])

  useEffect(() => {
    if (!composition?.compositionParts.length) return
    setPercentBySlot(buildDefaultPercentSlots(composition.compositionParts))
  }, [compositionKey, loadToken, composition?.compositionParts])

  const totalScu = parseTotalScuInput(totalScuInput)

  const materialRows = useMemo(() => {
    if (!composition?.compositionParts.length) return []
    return composition.compositionParts.map((part, index) => {
      const slotKey = compositionSlotKey(index)
      const percent = parsePercentInput(percentBySlot[slotKey] ?? '0')
      const scu =
        totalScu != null ? calculateMaterialScu(totalScu, percent) : null
      const dfp =
        totalScu != null && scu != null
          ? calculateMaterialDfpValue(part.elementName, scu)
          : null
      return {
        slotKey,
        part,
        index,
        percent,
        scu,
        dfp,
        label: formatCompositionRowLabel(part, composition.compositionParts),
        rangeHint: formatCompositionRangeHint(part),
      }
    })
  }, [composition, percentBySlot, totalScu])

  const percentTotal = sumPercentages(materialRows.map((row) => row.percent))
  const percentOver = isPercentOverLimit(percentTotal)

  const handleSelectOre = (name: string) => {
    setOreName(name)
    setSearchQuery(name)
    setSearchOpen(false)
    setProfileMode('overall')
    setLocationName(undefined)
    setTotalScuInput('')
    const types = getDepositTypes(name)
    if (types.length === 1) {
      setDepositType(types[0])
    } else if (!types.includes(depositType)) {
      setDepositType(types.includes('asteroid') ? 'asteroid' : types[0] ?? 'asteroid')
    }
  }

  const handleDepositTypeChange = (next: DepositType) => {
    setDepositType(next)
    setProfileMode('overall')
    setLocationName(undefined)
  }

  const showDepositToggle = availableDepositTypes.length > 1

  return (
    <aside className="sticky top-14 self-start w-full xl:w-[280px] shrink-0">
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-hidden">
        <div className="px-3 py-2.5 bg-slate-800/90 border-b border-slate-700 min-h-[3.25rem]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Rock Calculator
          </p>
          {oreName ? (
            <>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white leading-tight">{oreName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300 uppercase tracking-wide">
                  {depositTypeLabel(depositType)}
                </span>
              </div>
              {composition?.sourceLabel ? (
                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={composition.sourceLabel}>
                  {composition.sourceLabel}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-slate-500 mt-1">Search an ore or click a tracked card</p>
          )}
        </div>

        <div className="p-3 space-y-3">
          <div className="relative">
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Ore
            </label>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                const exact = RS_ORE_NAMES.find(
                  (name) => name.toLowerCase() === e.target.value.trim().toLowerCase()
                )
                if (exact) handleSelectOre(exact)
              }}
              onFocus={(e) => {
                setSearchFocused(true)
                if (e.isTrusted && searchOptions.length > 0) setSearchOpen(true)
              }}
              onBlur={() => {
                setSearchFocused(false)
                window.setTimeout(() => {
                  setSearchOpen(false)
                  if (oreName) setSearchQuery(oreName)
                }, 150)
              }}
              placeholder="Type to search..."
              className="site-input w-full px-2 py-1.5 text-sm"
              spellCheck={false}
              autoComplete="off"
            />
            {searchOpen && searchOptions.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-slate-600 bg-slate-900 shadow-lg max-h-40 overflow-y-auto">
                {searchOptions.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-800 text-slate-200"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectOre(name)}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {showDepositToggle && (
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Deposit type
              </label>
              <div className="flex gap-1 p-0.5 bg-slate-800/60 rounded-lg">
                {availableDepositTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleDepositTypeChange(type)}
                    className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      depositType === type
                        ? 'bg-orange-600/90 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {depositTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Total rock SCU
            </label>
            <input
              type="number"
              min={0}
              step={0.001}
              inputMode="decimal"
              value={totalScuInput}
              onChange={(e) => setTotalScuInput(e.target.value)}
              placeholder="0.000"
              className="site-input w-full px-2 py-1.5 text-sm font-mono tabular-nums"
            />
          </div>

          {oreName && !composition?.compositionParts.length ? (
            <p className="text-xs text-slate-500 py-2">
              No composition data for this profile.
            </p>
          ) : null}

          {materialRows.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Materials</p>
                <div className="flex gap-2 text-[9px] uppercase tracking-wide text-slate-600 shrink-0">
                  <span className="w-[3.25rem] text-right">cSCU</span>
                  <span className="w-[3.5rem] text-right">DFP</span>
                </div>
              </div>
              <ul className="space-y-2">
                {materialRows.map((row) => (
                  <li key={row.slotKey} className="space-y-0.5">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs text-slate-200 truncate" title={row.label}>
                        {row.label}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">{row.rangeHint}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          inputMode="decimal"
                          value={percentBySlot[row.slotKey] ?? '0'}
                          onChange={(e) =>
                            setPercentBySlot((prev) => ({
                              ...prev,
                              [row.slotKey]: e.target.value,
                            }))
                          }
                          className="site-input w-full px-2 py-1 pr-6 text-xs font-mono tabular-nums"
                          aria-label={`${row.label} percentage`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">
                          %
                        </span>
                      </div>
                      <span
                        className="w-[3.25rem] text-right text-[10px] font-mono tabular-nums text-amber-300 shrink-0"
                        title="cSCU in rock"
                      >
                        {totalScu != null ? formatMaterialScu(row.scu ?? 0) : '—'}
                      </span>
                      <span
                        className="w-[3.5rem] text-right text-[10px] font-mono tabular-nums text-emerald-300 shrink-0"
                        title="Purchased Q0 DFP"
                      >
                        {totalScu != null ? formatRockDfpValue(row.dfp ?? 0) : '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-slate-600">DFP uses Purchased (Q0) catalog prices.</p>
            </div>
          ) : null}

          {materialRows.length > 0 && (
            <div
              className={`pt-2 border-t border-slate-800 text-xs ${
                percentOver ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>Total entered</span>
                <span className="font-mono tabular-nums font-medium">
                  {percentTotal.toFixed(1)}%
                </span>
              </div>
              {percentOver ? (
                <p className="mt-1 text-red-400/90">Percentages exceed 100% — check your scan values.</p>
              ) : percentTotal > 0 && percentTotal < 100 ? (
                <p className="mt-1 text-slate-500">
                  {(100 - percentTotal).toFixed(1)}% unaccounted
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
