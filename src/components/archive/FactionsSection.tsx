import React, { useState, useMemo } from 'react'
import factionsData from '../../data/factions.json'

interface FactionStanding {
  name: string
  minReputation: number
}

interface Faction {
  name: string
  uuid: string
  standings: FactionStanding[]
}

type FactionsData = Record<string, Faction>

const factions = factionsData as FactionsData

const STANDING_COLORS: Record<string, string> = {
  'Hostile': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Neutral': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'Jr. Contractor': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Contractor': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Sr. Contractor': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Veteran Contractor': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Head Contractor': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Elite Contractor': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

export default function FactionsSection() {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFaction, setExpandedFaction] = useState<string | null>(null)

  const factionList = useMemo(() => {
    return Object.entries(factions)
      .map(([slug, faction]) => ({ slug, ...faction }))
      .filter((f) => f.name !== '<= PLACEHOLDER =>')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  const filteredFactions = useMemo(() => {
    if (!searchTerm) return factionList
    const term = searchTerm.toLowerCase()
    return factionList.filter((f) => f.name.toLowerCase().includes(term))
  }, [factionList, searchTerm])

  const toggleFaction = (slug: string) => {
    setExpandedFaction(expandedFaction === slug ? null : slug)
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Understanding Reputation</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Each faction tracks your reputation separately. Completing contracts and missions 
          increases your standing, unlocking access to higher-tier contracts and blueprint rewards.
          The reputation thresholds below show how much reputation is required for each standing level.
        </p>
      </div>

      {/* Common standing ladder */}
      <div>
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Standard Standing Ladder
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {factionList[0]?.standings.filter(s => s.minReputation >= 0).map((standing) => (
            <div
              key={standing.name}
              className={`px-2 py-1 rounded border text-[10px] font-medium ${STANDING_COLORS[standing.name] || 'bg-slate-700 text-slate-400 border-slate-600'}`}
            >
              {standing.name}
              <span className="ml-1 opacity-70">({standing.minReputation.toLocaleString()}+)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search factions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="site-input w-full pl-9 pr-4 py-2 text-sm"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Stats */}
      <div className="text-xs text-slate-500">
        {filteredFactions.length} faction{filteredFactions.length !== 1 ? 's' : ''} found
      </div>

      {/* Faction list */}
      <div className="space-y-2">
        {filteredFactions.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No matching factions found.</p>
        ) : (
          filteredFactions.map((faction) => (
            <FactionCard
              key={faction.slug}
              faction={faction}
              isExpanded={expandedFaction === faction.slug}
              onToggle={() => toggleFaction(faction.slug)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface FactionCardProps {
  faction: Faction & { slug: string }
  isExpanded: boolean
  onToggle: () => void
}

function FactionCard({ faction, isExpanded, onToggle }: FactionCardProps) {
  const positiveStandings = faction.standings.filter((s) => s.minReputation >= 0)
  const maxRep = positiveStandings[positiveStandings.length - 1]?.minReputation || 0

  return (
    <div className="rounded-lg border border-slate-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-800/40 hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-600/30 to-amber-600/30 border border-orange-500/30 flex items-center justify-center">
            <span className="text-sm font-bold text-orange-300">
              {faction.name.charAt(0)}
            </span>
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-white">{faction.name}</h4>
            <span className="text-[10px] text-slate-500">
              {positiveStandings.length} standing levels
            </span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-3 border-t border-slate-700/50 bg-slate-900/40">
          {/* Visual reputation bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>0 Rep</span>
              <span>{maxRep.toLocaleString()} Rep</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
              {positiveStandings.map((standing, idx) => {
                const prevRep = idx > 0 ? positiveStandings[idx - 1].minReputation : 0
                const width = ((standing.minReputation - prevRep) / maxRep) * 100
                const colorClass = STANDING_COLORS[standing.name]?.split(' ')[0] || 'bg-slate-600'
                return (
                  <div
                    key={standing.name}
                    className={`h-full ${colorClass}`}
                    style={{ width: `${width}%` }}
                    title={`${standing.name}: ${standing.minReputation.toLocaleString()}+ rep`}
                  />
                )
              })}
            </div>
          </div>

          {/* Standing breakdown */}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left pb-2 font-medium">Standing</th>
                <th className="text-right pb-2 font-medium">Min Rep</th>
                <th className="text-right pb-2 font-medium">Rep Needed</th>
              </tr>
            </thead>
            <tbody>
              {positiveStandings.map((standing, idx) => {
                const prevRep = idx > 0 ? positiveStandings[idx - 1].minReputation : 0
                const repNeeded = standing.minReputation - prevRep
                return (
                  <tr key={standing.name} className="border-t border-slate-800/50">
                    <td className="py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${STANDING_COLORS[standing.name] || ''}`}>
                        {standing.name}
                      </span>
                    </td>
                    <td className="text-right text-slate-400">
                      {standing.minReputation.toLocaleString()}
                    </td>
                    <td className="text-right text-slate-500">
                      {idx === 0 ? '-' : `+${repNeeded.toLocaleString()}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
