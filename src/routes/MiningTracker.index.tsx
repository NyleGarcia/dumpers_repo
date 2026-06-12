import React, { useEffect, useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import { useMiningData } from '../hooks/useArchiveData'
import { useMiningTracker } from '../hooks/useMiningTracker'
import { useAuth } from '../contexts/AuthContext'
import { findOreByName } from '../lib/miningDataHelpers'
import {
  MINING_RARITY_COLORS,
  MINING_RARITY_LABELS,
  MINING_RARITY_ORDER,
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

export default function MiningTrackerRoute() {
  const { isGuestPreview } = useAuth()
  const { data, loading, error, refetch } = useMiningData()
  const { entries, addEntry, removeEntry, clearAll, isTracked } = useMiningTracker()
  const search = useSearch({ from: '/mining-tracker' })

  const [oreSearch, setOreSearch] = useState('')
  const [selectedOreName, setSelectedOreName] = useState<string>('')
  const [listRarityFilter, setListRarityFilter] = useState<string>('')
  const [multiplierCount, setMultiplierCount] = useState(() => readMiningTrackerMultiplier())

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
        return true
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

  return (
    <FeaturePageLayout
      title="Mining Tracker"
      subtitle={`Cluster RS reference for ores you are hunting — base signature through ${multiplierCount}×.`}
      badge={isGuestPreview ? 'Local only' : undefined}
      meta={
        isGuestPreview ? (
          <span className="text-amber-400/90">
            Tracked ores save in this browser only. Sign in for acquired blueprint tracking and more.
          </span>
        ) : (
          <span>
            Cluster RS = node count × base RS. Compare in-game scanner readings to the values below.
          </span>
        )
      }
      actions={
        <div className="flex items-center gap-3">
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
        </div>
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
                  {entries.length === 0
                    ? 'Nothing tracked yet. Add ores above or use Track in the Mining Guide.'
                    : 'No entries match your filter.'}
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
                      className={`p-4 rounded-xl border w-48 ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <span className={`text-lg font-semibold ${colors.text}`}>
                            {entry.oreName}
                          </span>
                          <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">
                            {MINING_RARITY_LABELS[entry.rarity] ?? entry.rarity}
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
                      ) : (
                        <p className="text-xs text-slate-500">No RS signature on file.</p>
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
