import React, { useEffect, useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import { useMiningData } from '../hooks/useArchiveData'
import { useMiningTracker } from '../hooks/useMiningTracker'
import { useAuth } from '../contexts/AuthContext'
import {
  buildLocationOresMap,
  findOreByName,
  getSortedLocations,
} from '../lib/miningDataHelpers'
import {
  LOCATION_SYSTEMS,
  MINING_RARITY_COLORS,
  MINING_RARITY_LABELS,
  MINING_RARITY_ORDER,
  MINING_SYSTEM_COLORS,
} from '../lib/miningConstants'
import {
  formatRsReading,
  getOreBaseSignature,
  getSignatureMultiples,
} from '../lib/miningSignatures'

export default function MiningTrackerRoute() {
  const { isGuestPreview } = useAuth()
  const { data, loading, error, refetch } = useMiningData()
  const { entries, addEntry, removeEntry, clearAll } = useMiningTracker()
  const search = useSearch({ from: '/mining-tracker' })

  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [selectedOreName, setSelectedOreName] = useState<string>('')
  const [oreSearch, setOreSearch] = useState('')
  const [listLocationFilter, setListLocationFilter] = useState<string>('')
  const [listRarityFilter, setListRarityFilter] = useState<string>('')

  const locationOresMap = useMemo(
    () => (data ? buildLocationOresMap(data) : {}),
    [data]
  )
  const allLocations = useMemo(
    () => getSortedLocations(locationOresMap),
    [locationOresMap]
  )

  const locationOres = useMemo(() => {
    if (!selectedLocation || !data) return []
    return (locationOresMap[selectedLocation] || []).slice().sort((a, b) => {
      const idxA = MINING_RARITY_ORDER.indexOf(a.rarity as (typeof MINING_RARITY_ORDER)[number])
      const idxB = MINING_RARITY_ORDER.indexOf(b.rarity as (typeof MINING_RARITY_ORDER)[number])
      return idxA - idxB
    })
  }, [selectedLocation, locationOresMap, data])

  const searchOreResults = useMemo(() => {
    if (selectedLocation || !data || oreSearch.length < 3) return []
    const term = oreSearch.toLowerCase()
    return data
      .filter((o) => o.ore_name.toLowerCase().includes(term))
      .sort((a, b) => a.ore_name.localeCompare(b.ore_name))
      .slice(0, 20)
  }, [selectedLocation, data, oreSearch])

  useEffect(() => {
    if (!search.ore || !data) return
    const ore = findOreByName(data, search.ore)
    if (!ore) return

    if (search.location) {
      setSelectedLocation(search.location)
      setSelectedOreName(ore.ore_name)
      setOreSearch('')
    } else {
      setSelectedLocation('')
      setOreSearch(ore.ore_name)
      setSelectedOreName(ore.ore_name)
    }

    if (search.add) {
      addEntry(ore.ore_name, ore.rarity, search.location ?? null)
    }
  }, [search.ore, search.location, search.add, data, addEntry])

  const handleAdd = () => {
    if (!data) return

    let ore = selectedLocation
      ? locationOres.find((o) => o.ore_name === selectedOreName)
      : findOreByName(data, selectedOreName) ?? searchOreResults.find((o) => o.ore_name === selectedOreName)

    if (!ore && oreSearch.length >= 3) {
      ore = findOreByName(data, oreSearch)
    }

    if (!ore) return

    const location = selectedLocation || null
    addEntry(ore.ore_name, ore.rarity, location)
    setSelectedOreName('')
    setOreSearch('')
  }

  const canAdd = useMemo(() => {
    if (!data) return false
    if (selectedLocation) return !!selectedOreName
    if (selectedOreName) return true
    if (oreSearch.length >= 3) return !!findOreByName(data, oreSearch)
    return false
  }, [data, selectedLocation, selectedOreName, oreSearch])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (listLocationFilter && entry.location !== listLocationFilter) return false
      if (listRarityFilter && entry.rarity !== listRarityFilter) return false
      return true
    })
  }, [entries, listLocationFilter, listRarityFilter])

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => b.addedAt - a.addedAt)
  }, [filteredEntries])

  return (
    <FeaturePageLayout
      title="Mining Tracker"
      subtitle="Cluster RS reference for ores you are hunting — base signature through 6×."
      badge="Local only"
      meta={
        isGuestPreview ? (
          <span className="text-amber-400/90">
            Tracked ores save in this browser only. Sign in for acquired blueprint tracking and more.
          </span>
        ) : (
          <span>
            Cluster RS = node count × base RS. Compare in-game scanner readings to the grid below.
          </span>
        )
      }
      actions={
        entries.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600/50 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            Clear all
          </button>
        ) : undefined
      }
    >
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

      {!loading && !error && data && (
        <div className="space-y-8">
          <section className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/20 space-y-4">
            <h2 className="text-sm font-semibold text-white">Add to tracker</h2>
            <p className="text-xs text-slate-500">
              Pick a location first to choose from ores found there, or leave location blank and
              search by ore name (minimum 3 characters).
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Location (optional)</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => {
                    setSelectedLocation(e.target.value)
                    setSelectedOreName('')
                    setOreSearch('')
                  }}
                  className="site-input w-full px-3 py-2 text-sm"
                >
                  <option value="">Any location — search by ore</option>
                  {allLocations.map((loc) => {
                    const system = LOCATION_SYSTEMS[loc]
                    return (
                      <option key={loc} value={loc}>
                        {loc}
                        {system ? ` (${system})` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              {selectedLocation ? (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ore at {selectedLocation}</label>
                  <select
                    value={selectedOreName}
                    onChange={(e) => setSelectedOreName(e.target.value)}
                    className="site-input w-full px-3 py-2 text-sm"
                  >
                    <option value="">Select ore...</option>
                    {locationOres.map((ore) => (
                      <option key={ore.id} value={ore.ore_name}>
                        {ore.ore_name} ({MINING_RARITY_LABELS[ore.rarity] ?? ore.rarity})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Search ore</label>
                  <input
                    type="text"
                    value={oreSearch}
                    onChange={(e) => {
                      setOreSearch(e.target.value)
                      setSelectedOreName('')
                    }}
                    placeholder="Type at least 3 characters..."
                    className="site-input w-full px-3 py-2 text-sm"
                  />
                  {oreSearch.length >= 3 && searchOreResults.length > 0 && (
                    <select
                      value={selectedOreName}
                      onChange={(e) => setSelectedOreName(e.target.value)}
                      className="site-input w-full px-3 py-2 text-sm mt-2"
                    >
                      <option value="">Select from matches...</option>
                      {searchOreResults.map((ore) => (
                        <option key={ore.id} value={ore.ore_name}>
                          {ore.ore_name} ({MINING_RARITY_LABELS[ore.rarity] ?? ore.rarity})
                        </option>
                      ))}
                    </select>
                  )}
                  {oreSearch.length >= 3 && searchOreResults.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">No matching ores.</p>
                  )}
                  {oreSearch.length > 0 && oreSearch.length < 3 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Enter {3 - oreSearch.length} more character{3 - oreSearch.length !== 1 ? 's' : ''}...
                    </p>
                  )}
                </div>
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
                <div className="flex flex-wrap gap-2">
                  <select
                    value={listLocationFilter}
                    onChange={(e) => setListLocationFilter(e.target.value)}
                    className="site-input px-2 py-1 text-xs"
                  >
                    <option value="">All locations</option>
                    {allLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
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
                </div>
              )}
            </div>

            {sortedEntries.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-dashed border-slate-700/50">
                <p className="text-slate-500 text-sm">
                  {entries.length === 0
                    ? 'Nothing tracked yet. Add ores above or use Track in the Mining Guide.'
                    : 'No entries match your filters.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedEntries.map((entry) => {
                  const colors = MINING_RARITY_COLORS[entry.rarity] || MINING_RARITY_COLORS.common
                  const baseSignature = getOreBaseSignature(entry.oreName)
                  const multiples = baseSignature ? getSignatureMultiples(baseSignature, 6) : []
                  const system = entry.location ? LOCATION_SYSTEMS[entry.location] : null
                  const systemColor = system ? MINING_SYSTEM_COLORS[system] : 'text-slate-400'

                  return (
                    <div
                      key={entry.id}
                      className={`p-4 sm:p-5 rounded-xl border ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-lg font-semibold ${colors.text}`}>
                              {entry.oreName}
                            </span>
                            {baseSignature && (
                              <span className="text-xs text-amber-400/90 font-mono">
                                base RS {formatRsReading(baseSignature)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                            <span className="uppercase tracking-wider">
                              {MINING_RARITY_LABELS[entry.rarity] ?? entry.rarity}
                            </span>
                            {entry.location ? (
                              <>
                                <span>·</span>
                                <span className="text-slate-300">{entry.location}</span>
                                {system && <span className={systemColor}>({system})</span>}
                              </>
                            ) : (
                              <span className="text-slate-600">· Any location</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="shrink-0 p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {multiples.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                          {multiples.map((reading, index) => (
                            <div
                              key={reading}
                              className="rounded-lg border border-slate-700/60 bg-slate-950/50 px-2 py-3 sm:py-4 text-center"
                            >
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                {index === 0 ? 'Base' : `${index + 1}×`}
                              </div>
                              <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-amber-300 leading-none tabular-nums">
                                {formatRsReading(reading)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No RS signature on file for this ore.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </FeaturePageLayout>
  )
}
