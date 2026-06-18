import React, { useEffect, useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import { useMiningData, type MiningData } from '../hooks/useArchiveData'
import { useMiningTracker } from '../hooks/useMiningTracker'
import { useAuth } from '../contexts/AuthContext'
import { findOreByName } from '../lib/miningDataHelpers'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import {
  LOCATION_SYSTEMS,
  MINING_RARITY_COLORS,
  MINING_RARITY_LABELS,
  MINING_RARITY_ORDER,
  MINING_SYSTEM_COLORS,
  ORE_SIGNATURES,
} from '../lib/miningConstants'
import {
  formatRsReading,
  getOreBaseSignature,
  getSignatureMultiples,
} from '../lib/miningSignatures'
import {
  readMiningTrackerMultiplier,
  writeMiningTrackerMultiplier,
} from '../lib/localGuestCache'
import TrackOreButton from '../components/TrackOreButton'

type ViewMode = 'tracker' | 'guide'

export default function MiningTrackerRoute() {
  const { isGuestPreview } = useAuth()
  const { data, loading, error, refetch } = useMiningData()
  const { entries, addEntry, removeEntry, clearAll, isTracked } = useMiningTracker()
  const search = useSearch({ from: '/mining-tracker' })

  const [viewMode, setViewMode] = useState<ViewMode>('tracker')
  const [oreSearch, setOreSearch] = useState('')
  const [selectedOreName, setSelectedOreName] = useState<string>('')
  const [listRarityFilter, setListRarityFilter] = useState<string>('')
  const [multiplierCount, setMultiplierCount] = useState(() => readMiningTrackerMultiplier())
  
  // Guide view state
  const [guideRarityFilter, setGuideRarityFilter] = useState<string | null>(null)
  const [guideSearch, setGuideSearch] = useState('')
  const [guideViewMode, setGuideViewMode] = useState<'ores' | 'locations'>('ores')
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedOre, setSelectedOre] = useState<MiningData | null>(null)

  const handleMultiplierChange = (count: number) => {
    setMultiplierCount(count)
    writeMiningTrackerMultiplier(count)
  }

  const allOreNames = useMemo(() => {
    if (!data) return []
    const seen = new Set<string>()
    return data
      .filter((o) => {
        if (seen.has(o.ore_name)) return false
        seen.add(o.ore_name)
        return getOreBaseSignature(o.ore_name) !== undefined
      })
      .sort((a, b) => a.ore_name.localeCompare(b.ore_name))
  }, [data])

  const searchOreResults = useMemo(() => {
    if (!data || oreSearch.length < 2) return []
    const term = oreSearch.toLowerCase()
    return allOreNames
      .filter((o) => o.ore_name.toLowerCase().includes(term))
      .slice(0, 15)
  }, [data, oreSearch, allOreNames])

  useEffect(() => {
    if (!search.ore || !data) return
    const ore = findOreByName(data, search.ore)
    if (!ore) return
    if (getOreBaseSignature(ore.ore_name) === undefined) return

    setOreSearch(ore.ore_name)
    setSelectedOreName(ore.ore_name)

    if (search.add) {
      addEntry(ore.ore_name, ore.rarity)
    }
  }, [search.ore, search.add, data, addEntry])

  const handleAdd = () => {
    if (!data) return

    let ore = findOreByName(data, selectedOreName) ?? searchOreResults.find((o) => o.ore_name === selectedOreName)

    if (!ore && oreSearch.length >= 2) {
      ore = findOreByName(data, oreSearch)
    }

    if (!ore) return

    addEntry(ore.ore_name, ore.rarity)
    setSelectedOreName('')
    setOreSearch('')
  }

  const canAdd = useMemo(() => {
    if (!data) return false
    const oreName = selectedOreName || oreSearch
    if (!oreName) return false
    const ore = findOreByName(data, oreName)
    if (!ore) return false
    if (getOreBaseSignature(ore.ore_name) === undefined) return false
    return !isTracked(ore.ore_name)
  }, [data, selectedOreName, oreSearch, isTracked])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (listRarityFilter && entry.rarity !== listRarityFilter) return false
      return true
    })
  }, [entries, listRarityFilter])

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => b.addedAt - a.addedAt)
  }, [filteredEntries])

  // Guide view computed data
  const groupedByRarity = useMemo(() => {
    if (!data) return {}
    return data.reduce<Record<string, MiningData[]>>((acc, item) => {
      if (!acc[item.rarity]) acc[item.rarity] = []
      acc[item.rarity].push(item)
      return acc
    }, {})
  }, [data])

  const locationOresMap = useMemo(() => {
    if (!data) return {}
    const map: Record<string, MiningData[]> = {}
    for (const ore of data) {
      for (const loc of ore.locations) {
        if (!map[loc]) map[loc] = []
        map[loc].push(ore)
      }
    }
    return map
  }, [data])

  const allLocations = useMemo(() => {
    return Object.keys(locationOresMap).sort((a, b) => {
      const sysA = LOCATION_SYSTEMS[a] || 'Unknown'
      const sysB = LOCATION_SYSTEMS[b] || 'Unknown'
      if (sysA !== sysB) return sysA.localeCompare(sysB)
      return a.localeCompare(b)
    })
  }, [locationOresMap])

  const guideFilteredData = useMemo(() => {
    let filtered = data || []
    if (guideRarityFilter) {
      filtered = filtered.filter((item) => item.rarity === guideRarityFilter)
    }
    if (guideSearch) {
      const term = guideSearch.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.ore_name.toLowerCase().includes(term) ||
          item.locations.some((loc) => loc.toLowerCase().includes(term))
      )
    }
    return filtered
  }, [data, guideRarityFilter, guideSearch])

  const guideFilteredLocations = useMemo(() => {
    if (!guideSearch) return allLocations
    const term = guideSearch.toLowerCase()
    return allLocations.filter(loc => 
      loc.toLowerCase().includes(term) ||
      locationOresMap[loc]?.some(ore => ore.ore_name.toLowerCase().includes(term))
    )
  }, [allLocations, locationOresMap, guideSearch])

  return (
    <FeaturePageLayout
      title="Mining Tracker"
      subtitle={viewMode === 'tracker' 
        ? `Cluster RS reference for ores you are hunting — base signature through ${multiplierCount}×.`
        : 'Browse all ores by rarity or find ores at specific locations.'
      }
      badge={isGuestPreview ? 'Local only' : undefined}
      meta={
        viewMode === 'tracker' ? (
          isGuestPreview ? (
            <span className="text-amber-400/90">
              Tracked ores save in this browser only. Sign in for acquired blueprint tracking and more.
            </span>
          ) : (
            <span>
              Cluster RS = node count × base RS. Compare in-game scanner readings to the values below.
            </span>
          )
        ) : (
          <span>
            Use the Track button to add ores to your tracker. Only ores with mining signatures can be tracked.
          </span>
        )
      }
      actions={
        <div className="flex items-center gap-3">
          {viewMode === 'tracker' && (
            <>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <span>Show</span>
                <select
                  value={multiplierCount}
                  onChange={(e) => handleMultiplierChange(Number(e.target.value))}
                  className="site-input px-2 py-1 text-xs w-14"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}×</option>
                  ))}
                </select>
              </label>
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-600/50 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
                >
                  Clear all
                </button>
              )}
            </>
          )}
        </div>
      }
    >
      {/* View Mode Switcher */}
      <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg w-fit mb-6">
        <button
          onClick={() => setViewMode('tracker')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'tracker' 
              ? 'bg-orange-600 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          RS Tracker
        </button>
        <button
          onClick={() => setViewMode('guide')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'guide' 
              ? 'bg-orange-600 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Mining Guide
        </button>
      </div>
      {loading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && data && viewMode === 'tracker' && (
        <div className="space-y-8">
          <section className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/20 space-y-4">
            <h2 className="text-sm font-semibold text-white">Add to tracker</h2>
            <p className="text-xs text-slate-500">
              Search for an ore by name (minimum 2 characters).
            </p>

            <div className="max-w-md">
              <label className="block text-xs text-slate-500 mb-1">Search ore</label>
              <input
                type="text"
                value={oreSearch}
                onChange={(e) => {
                  setOreSearch(e.target.value)
                  setSelectedOreName('')
                }}
                placeholder="Type ore name..."
                className="site-input w-full px-3 py-2 text-sm"
              />
              {oreSearch.length >= 2 && searchOreResults.length > 0 && (
                <select
                  value={selectedOreName}
                  onChange={(e) => setSelectedOreName(e.target.value)}
                  className="site-input w-full px-3 py-2 text-sm mt-2"
                >
                  <option value="">Select from matches...</option>
                  {searchOreResults.map((ore) => {
                    const alreadyTracked = isTracked(ore.ore_name)
                    return (
                      <option key={ore.id} value={ore.ore_name} disabled={alreadyTracked}>
                        {ore.ore_name} ({MINING_RARITY_LABELS[ore.rarity] ?? ore.rarity})
                        {alreadyTracked ? ' — already tracked' : ''}
                      </option>
                    )
                  })}
                </select>
              )}
              {oreSearch.length >= 2 && searchOreResults.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">No matching ores.</p>
              )}
              {oreSearch.length > 0 && oreSearch.length < 2 && (
                <p className="text-xs text-slate-500 mt-1">
                  Enter {2 - oreSearch.length} more character{2 - oreSearch.length !== 1 ? 's' : ''}...
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              Add to tracker
            </button>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">
                Tracked ({sortedEntries.length}
                {sortedEntries.length !== entries.length ? ` of ${entries.length}` : ''})
              </h2>
              {entries.length > 0 && (
                <select
                  value={listRarityFilter}
                  onChange={(e) => setListRarityFilter(e.target.value)}
                  className="site-input px-2 py-1 text-xs"
                >
                  <option value="">All rarities</option>
                  {MINING_RARITY_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {MINING_RARITY_LABELS[r]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {sortedEntries.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-dashed border-slate-700/50">
                <p className="text-slate-500 text-sm">
                  {entries.length === 0 ? (
                    <>
                      Nothing tracked yet. Add ores above or browse the{' '}
                      <button
                        type="button"
                        onClick={() => setViewMode('guide')}
                        className="text-orange-400 hover:text-orange-300 underline"
                      >
                        Mining Guide
                      </button>
                      .
                    </>
                  ) : (
                    'No entries match your filter.'
                  )}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {sortedEntries.map((entry) => {
                  const colors = MINING_RARITY_COLORS[entry.rarity] || MINING_RARITY_COLORS.common
                  const baseSignature = getOreBaseSignature(entry.oreName)
                  const multiples = baseSignature ? getSignatureMultiples(baseSignature, multiplierCount) : []

                  return (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-xl border w-48 text-center relative ${colors.bg} ${colors.border}`}
                    >
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      <div className="mb-3">
                        <span className={`text-lg font-semibold ${colors.text}`}>
                          {entry.oreName}
                        </span>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">
                          {MINING_RARITY_LABELS[entry.rarity] ?? entry.rarity}
                        </div>
                      </div>

                      {multiples.length > 0 ? (
                        <div className="space-y-1">
                          {multiples.map((reading) => (
                            <div
                              key={reading}
                              className="text-2xl font-bold font-mono text-amber-300 tabular-nums"
                            >
                              {formatRsReading(reading)}
                            </div>
                          ))}
                        </div>
                      ) : entry.rarity === 'handMineable' ? (
                        <p className="text-xs text-slate-500">Hand-mineable only (no ship RS)</p>
                      ) : (
                        <p className="text-xs text-slate-500">RS signature not on file</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Mining Guide View */}
      {!loading && !error && data && viewMode === 'guide' && (
        <div className="space-y-6">
          {/* Guide view mode toggle */}
          <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg w-fit">
            <button
              onClick={() => setGuideViewMode('ores')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                guideViewMode === 'ores' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              By Ore
            </button>
            <button
              onClick={() => setGuideViewMode('locations')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                guideViewMode === 'locations' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              By Location
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={guideViewMode === 'ores' ? "Search ores or locations..." : "Search locations or ores..."}
                value={guideSearch}
                onChange={(e) => setGuideSearch(e.target.value)}
                className="site-input w-full pl-9 pr-4 py-2 text-sm"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {guideViewMode === 'ores' && (
              <select
                value={guideRarityFilter || ''}
                onChange={(e) => setGuideRarityFilter(e.target.value || null)}
                className="site-input px-3 py-2 text-sm"
              >
                <option value="">All Rarities</option>
                {MINING_RARITY_ORDER.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {MINING_RARITY_LABELS[rarity]} ({groupedByRarity[rarity]?.length || 0})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Stats summary - only in ore view */}
          {guideViewMode === 'ores' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {MINING_RARITY_ORDER.map((rarity) => {
                const colors = MINING_RARITY_COLORS[rarity]
                const count = groupedByRarity[rarity]?.length || 0
                return (
                  <button
                    key={rarity}
                    onClick={() => setGuideRarityFilter(guideRarityFilter === rarity ? null : rarity)}
                    className={`
                      p-2 rounded-lg border text-center transition-all
                      ${guideRarityFilter === rarity ? colors.bg + ' ' + colors.border : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'}
                    `}
                  >
                    <span className={`text-lg font-bold ${guideRarityFilter === rarity ? colors.text : 'text-white'}`}>
                      {count}
                    </span>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider">
                      {MINING_RARITY_LABELS[rarity]}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Results */}
          {guideViewMode === 'ores' ? (
            <div className="space-y-3">
              {guideFilteredData.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No matching ores found.</p>
              ) : (
                guideFilteredData.map((item) => (
                  <GuideOreCard key={item.id} item={item} onLocationClick={setSelectedLocation} />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {guideFilteredLocations.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No matching locations found.</p>
              ) : (
                guideFilteredLocations.map((location) => (
                  <GuideLocationCard
                    key={location}
                    location={location}
                    ores={locationOresMap[location] || []}
                    onOreClick={setSelectedOre}
                  />
                ))
              )}
            </div>
          )}

          {/* Location detail modal */}
          {selectedLocation && (
            <GuideLocationModal
              location={selectedLocation}
              ores={locationOresMap[selectedLocation] || []}
              onClose={() => setSelectedLocation(null)}
            />
          )}

          {/* Ore detail modal */}
          {selectedOre && (
            <GuideOreModal
              ore={selectedOre}
              onClose={() => setSelectedOre(null)}
            />
          )}
        </div>
      )}
    </FeaturePageLayout>
  )
}

// ===== Guide View Helper Components =====

function GuideOreCard({ item, onLocationClick }: { item: MiningData; onLocationClick: (loc: string) => void }) {
  const colors = MINING_RARITY_COLORS[item.rarity] || MINING_RARITY_COLORS.common
  const signature = ORE_SIGNATURES[item.ore_name]
  
  return (
    <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`font-semibold ${colors.text}`}>{item.ore_name}</h3>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500 uppercase tracking-wider">
              {MINING_RARITY_LABELS[item.rarity]}
            </span>
            {signature && (
              <span className="text-xs text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">
                RS {signature}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {signature && (
            <TrackOreButton oreName={item.ore_name} rarity={item.rarity} compact />
          )}
          <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
            {item.locations.length} location{item.locations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.locations.map((location, idx) => {
          const system = LOCATION_SYSTEMS[location]
          const systemColor = system ? MINING_SYSTEM_COLORS[system] : 'text-slate-400'
          return (
            <button
              key={idx}
              onClick={() => onLocationClick(location)}
              className="text-xs px-2 py-1 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors cursor-pointer text-left"
            >
              {location}
              {system && (
                <span className={`ml-1 ${systemColor} opacity-70`}>({system})</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GuideLocationCard({
  location,
  ores,
  onOreClick,
}: {
  location: string
  ores: MiningData[]
  onOreClick: (ore: MiningData) => void
}) {
  const system = LOCATION_SYSTEMS[location]
  const systemColor = system ? MINING_SYSTEM_COLORS[system] : 'text-slate-400'
  
  const sortedOres = [...ores].sort((a, b) => {
    return MINING_RARITY_ORDER.indexOf(a.rarity) - MINING_RARITY_ORDER.indexOf(b.rarity)
  })
  
  return (
    <div className="p-4 rounded-lg border bg-slate-800/30 border-slate-700/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white">{location}</h3>
          {system && (
            <span className={`text-xs ${systemColor} uppercase tracking-wider`}>
              {system} System
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
          {ores.length} ore{ores.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sortedOres.map((ore) => {
          const colors = MINING_RARITY_COLORS[ore.rarity] || MINING_RARITY_COLORS.common
          const signature = ORE_SIGNATURES[ore.ore_name]
          return (
            <button
              key={ore.id}
              type="button"
              onClick={() => onOreClick(ore)}
              className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text} border ${colors.border} hover:brightness-125 transition-all cursor-pointer text-left`}
            >
              {ore.ore_name}
              {signature && (
                <span className="ml-1 text-amber-400/70 font-mono text-[10px]">
                  {signature}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GuideOreModal({ ore, onClose }: { ore: MiningData; onClose: () => void }) {
  useBodyScrollLock(true)

  const colors = MINING_RARITY_COLORS[ore.rarity] || MINING_RARITY_COLORS.common
  const signature = ORE_SIGNATURES[ore.ore_name]

  const sortedLocations = [...ore.locations].sort((a, b) => {
    const sysA = LOCATION_SYSTEMS[a] || 'Unknown'
    const sysB = LOCATION_SYSTEMS[b] || 'Unknown'
    if (sysA !== sysB) return sysA.localeCompare(sysB)
    return a.localeCompare(b)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 className={`text-lg font-semibold ${colors.text}`}>{ore.ore_name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                {MINING_RARITY_LABELS[ore.rarity]}
              </span>
              {signature && (
                <span className="text-xs text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">
                  RS {signature}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {signature && (
              <TrackOreButton oreName={ore.ore_name} rarity={ore.rarity} showTrackerLink />
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-slate-400 mb-4">
            Found at {ore.locations.length} location{ore.locations.length !== 1 ? 's' : ''}:
          </p>
          <div className="space-y-2">
            {sortedLocations.map((location) => {
              const system = LOCATION_SYSTEMS[location]
              const systemColor = system ? MINING_SYSTEM_COLORS[system] : 'text-slate-400'
              return (
                <div
                  key={location}
                  className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50"
                >
                  <span className="font-medium text-white">{location}</span>
                  {system && (
                    <span className={`block text-xs ${systemColor} mt-0.5`}>{system} System</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function GuideLocationModal({ location, ores, onClose }: { location: string; ores: MiningData[]; onClose: () => void }) {
  useBodyScrollLock(true)
  
  const system = LOCATION_SYSTEMS[location]
  const systemColor = system ? MINING_SYSTEM_COLORS[system] : 'text-slate-400'
  
  const sortedOres = [...ores].sort((a, b) => {
    return MINING_RARITY_ORDER.indexOf(a.rarity) - MINING_RARITY_ORDER.indexOf(b.rarity)
  })
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{location}</h2>
            {system && (
              <span className={`text-sm ${systemColor}`}>{system} System</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-slate-400 mb-4">
            {ores.length} ore{ores.length !== 1 ? 's' : ''} found at this location:
          </p>
          <div className="space-y-2">
            {sortedOres.map((ore) => {
              const colors = MINING_RARITY_COLORS[ore.rarity] || MINING_RARITY_COLORS.common
              const signature = ORE_SIGNATURES[ore.ore_name]
              return (
                <div
                  key={ore.id}
                  className={`p-3 rounded-lg ${colors.bg} border ${colors.border}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${colors.text}`}>{ore.ore_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {signature && (
                        <>
                          <TrackOreButton
                            oreName={ore.ore_name}
                            rarity={ore.rarity}
                            compact
                          />
                          <span className="text-xs text-amber-400 font-mono bg-amber-500/10 px-2 py-1 rounded">
                            RS {signature}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 uppercase">
                    {MINING_RARITY_LABELS[ore.rarity]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
