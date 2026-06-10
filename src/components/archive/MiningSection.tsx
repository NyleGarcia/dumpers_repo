import React, { useState, useMemo } from 'react'
import { useMiningData, type MiningData } from '../../hooks/useArchiveData'

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common', 'handMineable']

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  legendary: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  epic: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  rare: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  uncommon: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  common: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  handMineable: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

const RARITY_LABELS: Record<string, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
  handMineable: 'Hand Mineable',
}

export default function MiningSection() {
  const { data, loading, error, refetch } = useMiningData()
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const groupedByRarity = useMemo(() => {
    if (!data) return {}
    return data.reduce<Record<string, MiningData[]>>((acc, item) => {
      if (!acc[item.rarity]) acc[item.rarity] = []
      acc[item.rarity].push(item)
      return acc
    }, {})
  }, [data])

  const filteredData = useMemo(() => {
    let filtered = data || []
    
    if (selectedRarity) {
      filtered = filtered.filter((item) => item.rarity === selectedRarity)
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.ore_name.toLowerCase().includes(term) ||
          item.locations.some((loc) => loc.toLowerCase().includes(term))
      )
    }
    
    return filtered
  }, [data, selectedRarity, searchTerm])

  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />
  }

  if (!data || data.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search ores or locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="site-input w-full pl-9 pr-4 py-2 text-sm"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={selectedRarity || ''}
          onChange={(e) => setSelectedRarity(e.target.value || null)}
          className="site-input px-3 py-2 text-sm"
        >
          <option value="">All Rarities</option>
          {RARITY_ORDER.map((rarity) => (
            <option key={rarity} value={rarity}>
              {RARITY_LABELS[rarity]} ({groupedByRarity[rarity]?.length || 0})
            </option>
          ))}
        </select>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {RARITY_ORDER.map((rarity) => {
          const colors = RARITY_COLORS[rarity]
          const count = groupedByRarity[rarity]?.length || 0
          return (
            <button
              key={rarity}
              onClick={() => setSelectedRarity(selectedRarity === rarity ? null : rarity)}
              className={`
                p-2 rounded-lg border text-center transition-all
                ${selectedRarity === rarity ? colors.bg + ' ' + colors.border : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'}
              `}
            >
              <span className={`text-lg font-bold ${selectedRarity === rarity ? colors.text : 'text-white'}`}>
                {count}
              </span>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">
                {RARITY_LABELS[rarity]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filteredData.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No matching ores found.</p>
        ) : (
          filteredData.map((item) => (
            <OreCard key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  )
}

function OreCard({ item }: { item: MiningData }) {
  const colors = RARITY_COLORS[item.rarity] || RARITY_COLORS.common
  
  return (
    <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`font-semibold ${colors.text}`}>{item.ore_name}</h3>
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            {RARITY_LABELS[item.rarity]}
          </span>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
          {item.locations.length} location{item.locations.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.locations.map((location, idx) => (
          <span
            key={idx}
            className="text-xs px-2 py-1 rounded bg-slate-800/60 text-slate-300"
          >
            {location}
          </span>
        ))}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading mining data...</p>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-slate-400 mb-4">{message}</p>
      <button onClick={onRetry} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
        Try Again
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/50 border border-slate-700/50 mb-4">
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <p className="text-slate-400">No mining data available.</p>
      <p className="text-sm text-slate-500 mt-1">Ask a super-admin to sync the StarStrings data.</p>
    </div>
  )
}
