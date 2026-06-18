import React, { useState, useMemo } from 'react'
import blueprintMissionData from '../data/game-blueprint-missions.json'
import { useBlueprintData } from '../routes/blueprints'

type BlueprintRecord = {
  file: string
  internalName?: string
  blueprintName?: string
  [key: string]: unknown
}

type MissionPoolBlueprint = {
  name: string
  weight: number
  path: string
}

type System = 'stanton' | 'pyro' | 'nyx' | 'unknown'

type ViewMode = 'system' | 'faction'

type MissionPool = {
  key: string
  displayName: string
  faction: string
  system: System
  isLawful: boolean
  blueprintCount: number
}

const SYSTEM_LABELS: Record<System, string> = {
  stanton: 'Stanton',
  pyro: 'Pyro',
  nyx: 'Nyx',
  unknown: 'Unknown / Multiple',
}

const SYSTEM_COLORS: Record<System, { bg: string; border: string; text: string }> = {
  stanton: { bg: 'bg-blue-950/50', border: 'border-blue-500/40', text: 'text-blue-300' },
  pyro: { bg: 'bg-orange-950/50', border: 'border-orange-500/40', text: 'text-orange-300' },
  nyx: { bg: 'bg-purple-950/50', border: 'border-purple-500/40', text: 'text-purple-300' },
  unknown: { bg: 'bg-slate-800/50', border: 'border-slate-600/40', text: 'text-slate-400' },
}

const FACTION_PATTERNS: Record<string, { name: string; isLawful: boolean }> = {
  'shubin': { name: 'Shubin Interstellar', isLawful: true },
  'adagio': { name: 'Adagio Holdings', isLawful: true },
  'covalex': { name: 'Covalex', isLawful: true },
  'eckhart': { name: 'Eckhart Security', isLawful: true },
  'northrock': { name: 'Northrock Service Group', isLawful: true },
  'crusader': { name: 'Crusader Security', isLawful: true },
  'hurston': { name: 'Hurston Security', isLawful: true },
  'microtech': { name: 'microTech', isLawful: true },
  'citizensforprosperity': { name: 'Citizens for Prosperity', isLawful: true },
  'cfp': { name: 'Citizens for Prosperity', isLawful: true },
  'headhunter': { name: 'Headhunters', isLawful: false },
  'ninetail': { name: 'Nine Tails', isLawful: false },
  'bountyhunter': { name: 'Bounty Hunters Guild', isLawful: true },
  'cdf': { name: 'Civilian Defense Force', isLawful: true },
  'xenothreat': { name: 'Xenothreat', isLawful: false },
  'rayari': { name: 'Rayari Deltana', isLawful: true },
}

const FACTION_DEFAULT_SYSTEMS: Record<string, System> = {
  'Shubin Interstellar': 'stanton',
  'Adagio Holdings': 'stanton',
  'Covalex': 'stanton',
  'Eckhart Security': 'stanton',
  'Northrock Service Group': 'stanton',
  'Crusader Security': 'stanton',
  'microTech': 'stanton',
  'Bounty Hunters Guild': 'stanton',
  'Civilian Defense Force': 'stanton',
  'Citizens for Prosperity': 'pyro',
  'Headhunters': 'pyro',
  'Xenothreat': 'pyro',
  'Rayari Deltana': 'nyx',
}

function parseMissionPoolKey(key: string): { faction: string; system: System; isLawful: boolean; displayName: string } {
  const keyLower = key.toLowerCase()
  
  let faction = 'Unknown'
  let isLawful = true
  
  for (const [pattern, info] of Object.entries(FACTION_PATTERNS)) {
    if (keyLower.includes(pattern)) {
      faction = info.name
      isLawful = info.isLawful
      break
    }
  }
  
  let system: System = 'unknown'
  
  if (keyLower.includes('stanton')) {
    system = 'stanton'
  } else if (keyLower.includes('pyronyx')) {
    system = 'pyro'
  } else if (keyLower.includes('pyro')) {
    system = 'pyro'
  } else if (keyLower.includes('nyx')) {
    system = 'nyx'
  } else if (/region[a-d]/i.test(keyLower)) {
    system = 'pyro'
  } else if (faction !== 'Unknown' && FACTION_DEFAULT_SYSTEMS[faction]) {
    system = FACTION_DEFAULT_SYSTEMS[faction]
  }
  
  const displayName = key
    .replace(/^BP_MISSIONREWARD_/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b(Stanton|Pyro|Nyx|PyroNyx)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  return { faction, system, isLawful, displayName }
}

interface BrowseMissionsViewProps {
  acquiredBlueprints: Record<string, boolean>
  onAddToTracker: (blueprintId: string) => void
  isOnTargetList: (blueprintId: string) => boolean
}

export default function BrowseMissionsView({
  acquiredBlueprints,
  onAddToTracker,
  isOnTargetList,
}: BrowseMissionsViewProps) {
  const { data: blueprints = [] } = useBlueprintData()
  const [viewMode, setViewMode] = useState<ViewMode>('system')
  const [selectedSystem, setSelectedSystem] = useState<System | null>(null)
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null)
  const [selectedMissionPool, setSelectedMissionPool] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const missionBlueprints = blueprintMissionData.missionBlueprints as Record<string, MissionPoolBlueprint[]>

  const blueprintsByInternalName = useMemo(() => {
    const map: Record<string, BlueprintRecord> = {}
    for (const bp of blueprints as BlueprintRecord[]) {
      if (bp.internalName) {
        map[bp.internalName.toLowerCase()] = bp
      }
      const fileMatch = bp.file?.match(/bp_craft_([^/\\]+?)(?:_scitem)?\.json$/i)
      if (fileMatch) {
        map[fileMatch[1].toLowerCase()] = bp
      }
    }
    return map
  }, [blueprints])

  const missionPools = useMemo((): MissionPool[] => {
    return Object.entries(missionBlueprints).map(([key, bps]) => {
      const parsed = parseMissionPoolKey(key)
      return {
        key,
        displayName: parsed.displayName,
        faction: parsed.faction,
        system: parsed.system,
        isLawful: parsed.isLawful,
        blueprintCount: bps.length,
      }
    })
  }, [missionBlueprints])

  const systemStats = useMemo(() => {
    const stats: Record<System, { factions: Set<string>; pools: number }> = {
      stanton: { factions: new Set(), pools: 0 },
      pyro: { factions: new Set(), pools: 0 },
      nyx: { factions: new Set(), pools: 0 },
      unknown: { factions: new Set(), pools: 0 },
    }
    
    for (const pool of missionPools) {
      stats[pool.system].factions.add(pool.faction)
      stats[pool.system].pools++
    }
    
    return stats
  }, [missionPools])

  const factionsBySystem = useMemo(() => {
    const map: Record<System, Record<string, MissionPool[]>> = {
      stanton: {},
      pyro: {},
      nyx: {},
      unknown: {},
    }
    
    for (const pool of missionPools) {
      if (!map[pool.system][pool.faction]) {
        map[pool.system][pool.faction] = []
      }
      map[pool.system][pool.faction].push(pool)
    }
    
    return map
  }, [missionPools])

  // For faction view: group all pools by faction (across all systems)
  const poolsByFaction = useMemo(() => {
    const map: Record<string, { pools: MissionPool[]; isLawful: boolean; systems: Set<System> }> = {}
    
    for (const pool of missionPools) {
      if (!map[pool.faction]) {
        map[pool.faction] = { pools: [], isLawful: pool.isLawful, systems: new Set() }
      }
      map[pool.faction].pools.push(pool)
      map[pool.faction].systems.add(pool.system)
    }
    
    return map
  }, [missionPools])

  const filteredFactionsList = useMemo(() => {
    const entries = Object.entries(poolsByFaction)
    
    if (!searchTerm) return entries
    
    const term = searchTerm.toLowerCase()
    return entries.filter(([faction, data]) => 
      faction.toLowerCase().includes(term) ||
      data.pools.some(p => p.displayName.toLowerCase().includes(term))
    )
  }, [poolsByFaction, searchTerm])

  const filteredFactions = useMemo(() => {
    if (!selectedSystem) return {}
    const factions = factionsBySystem[selectedSystem]
    
    if (!searchTerm) return factions
    
    const term = searchTerm.toLowerCase()
    const filtered: Record<string, MissionPool[]> = {}
    for (const [faction, pools] of Object.entries(factions)) {
      const matchingPools = pools.filter(p => 
        p.displayName.toLowerCase().includes(term) ||
        faction.toLowerCase().includes(term)
      )
      if (matchingPools.length > 0) {
        filtered[faction] = matchingPools
      }
    }
    return filtered
  }, [selectedSystem, factionsBySystem, searchTerm])

  const selectedFactionPools = useMemo((): MissionPool[] => {
    if (!selectedSystem || !selectedFaction) return []
    return factionsBySystem[selectedSystem][selectedFaction] || []
  }, [selectedSystem, selectedFaction, factionsBySystem])

  const selectedPoolBlueprints = useMemo(() => {
    if (!selectedMissionPool) return []
    
    const poolBps = missionBlueprints[selectedMissionPool] || []
    
    return poolBps.map(bp => {
      const bpName = bp.name.toLowerCase()
      const fullBp = blueprintsByInternalName[bpName]
      const isAcquired = fullBp ? !!acquiredBlueprints[fullBp.file] : false
      const isTracked = fullBp ? isOnTargetList(fullBp.file) : false
      
      return {
        ...bp,
        fullBlueprint: fullBp,
        displayName: (fullBp?.blueprintName as string) || bp.name.replace(/_/g, ' '),
        isAcquired,
        isTracked,
      }
    }).sort((a, b) => {
      if (a.isAcquired !== b.isAcquired) return a.isAcquired ? 1 : -1
      return a.displayName.localeCompare(b.displayName)
    })
  }, [selectedMissionPool, missionBlueprints, blueprintsByInternalName, acquiredBlueprints, isOnTargetList])

  const poolStats = useMemo(() => {
    const total = selectedPoolBlueprints.length
    const acquired = selectedPoolBlueprints.filter(b => b.isAcquired).length
    return { total, acquired }
  }, [selectedPoolBlueprints])

  const handleBack = () => {
    if (selectedMissionPool) {
      setSelectedMissionPool(null)
    } else if (selectedFaction) {
      setSelectedFaction(null)
    } else if (selectedSystem) {
      setSelectedSystem(null)
    }
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setSelectedSystem(null)
    setSelectedFaction(null)
    setSelectedMissionPool(null)
    setSearchTerm('')
  }

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick: () => void }[] = []
    
    if (viewMode === 'system') {
      crumbs.push({ label: 'Systems', onClick: () => { setSelectedSystem(null); setSelectedFaction(null); setSelectedMissionPool(null) } })
      
      if (selectedSystem) {
        crumbs.push({
          label: SYSTEM_LABELS[selectedSystem],
          onClick: () => { setSelectedFaction(null); setSelectedMissionPool(null) },
        })
      }
      
      if (selectedFaction) {
        crumbs.push({
          label: selectedFaction,
          onClick: () => { setSelectedMissionPool(null) },
        })
      }
    } else {
      crumbs.push({ label: 'Factions', onClick: () => { setSelectedFaction(null); setSelectedMissionPool(null) } })
      
      if (selectedFaction) {
        crumbs.push({
          label: selectedFaction,
          onClick: () => { setSelectedMissionPool(null) },
        })
      }
    }
    
    if (selectedMissionPool) {
      const pool = missionPools.find(p => p.key === selectedMissionPool)
      crumbs.push({
        label: pool?.displayName || selectedMissionPool,
        onClick: () => {},
      })
    }
    
    return crumbs
  }, [viewMode, selectedSystem, selectedFaction, selectedMissionPool, missionPools])

  return (
    <div className="space-y-4">
      {/* View Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-600">›</span>}
              <button
                onClick={crumb.onClick}
                className={`${
                  idx === breadcrumbs.length - 1
                    ? 'text-orange-400 cursor-default'
                    : 'text-slate-400 hover:text-white'
                }`}
                disabled={idx === breadcrumbs.length - 1}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        {/* View toggle - only show when at top level */}
        {!selectedFaction && !selectedMissionPool && (
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/50">
            <button
              onClick={() => handleViewModeChange('system')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'system'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              By System
            </button>
            <button
              onClick={() => handleViewModeChange('faction')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'faction'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              By Faction
            </button>
          </div>
        )}
      </div>

      {/* ========== SYSTEM VIEW ========== */}
      
      {/* System Selection */}
      {viewMode === 'system' && !selectedSystem && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['stanton', 'pyro', 'nyx', 'unknown'] as System[]).map(system => {
            const stats = systemStats[system]
            const colors = SYSTEM_COLORS[system]
            if (stats.pools === 0) return null
            
            return (
              <button
                key={system}
                onClick={() => setSelectedSystem(system)}
                className={`p-4 rounded-xl border transition-all hover:scale-[1.02] ${colors.bg} ${colors.border}`}
              >
                <h3 className={`text-lg font-semibold ${colors.text}`}>{SYSTEM_LABELS[system]}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {stats.factions.size} faction{stats.factions.size !== 1 ? 's' : ''} • {stats.pools} mission pool{stats.pools !== 1 ? 's' : ''}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Faction Selection (System View) */}
      {viewMode === 'system' && selectedSystem && !selectedFaction && (
        <>
          <div className="relative">
            <input
              type="text"
              placeholder="Search factions or mission pools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="site-input w-full pl-9 pr-4 py-2 text-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(filteredFactions)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([faction, pools]) => {
                const isLawful = pools[0]?.isLawful ?? true
                return (
                  <button
                    key={faction}
                    onClick={() => setSelectedFaction(faction)}
                    className={`p-3 rounded-lg border text-left transition-all hover:scale-[1.01] ${
                      isLawful 
                        ? 'bg-green-950/30 border-green-500/30 hover:border-green-500/50'
                        : 'bg-red-950/30 border-red-500/30 hover:border-red-500/50'
                    }`}
                  >
                    <h4 className={`font-medium ${isLawful ? 'text-green-300' : 'text-red-400'}`}>
                      {faction}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pools.length} mission pool{pools.length !== 1 ? 's' : ''} with blueprints
                    </p>
                  </button>
                )
              })}
          </div>
        </>
      )}

      {/* Mission Pool Selection (System View) */}
      {viewMode === 'system' && selectedSystem && selectedFaction && !selectedMissionPool && (
        <div className="space-y-2">
          {selectedFactionPools.map(pool => {
            const poolBps = missionBlueprints[pool.key] || []
            const acquiredCount = poolBps.filter(bp => {
              const bpName = bp.name.toLowerCase()
              const fullBp = blueprintsByInternalName[bpName]
              return fullBp && acquiredBlueprints[fullBp.file]
            }).length
            
            return (
              <button
                key={pool.key}
                onClick={() => setSelectedMissionPool(pool.key)}
                className={`w-full p-3 rounded-lg border text-left transition-all hover:bg-slate-800/50 ${
                  pool.isLawful 
                    ? 'border-green-500/20 hover:border-green-500/40'
                    : 'border-red-500/20 hover:border-red-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-sm ${pool.isLawful ? 'text-green-300' : 'text-red-400'}`}>
                      {pool.displayName}
                    </h4>
                    {!pool.isLawful && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-950/50 text-red-400 border border-red-500/40 rounded mt-1 inline-block">
                        Illegal
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-sm font-medium ${
                      acquiredCount === poolBps.length ? 'text-green-400' : 'text-amber-400'
                    }`}>
                      {acquiredCount}/{poolBps.length}
                    </span>
                    <p className="text-[10px] text-slate-500">blueprints</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ========== FACTION VIEW ========== */}
      
      {/* Faction List (Faction View) */}
      {viewMode === 'faction' && !selectedFaction && (
        <>
          <div className="relative">
            <input
              type="text"
              placeholder="Search factions or mission pools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="site-input w-full pl-9 pr-4 py-2 text-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFactionsList
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([faction, data]) => {
                const systemsArray = Array.from(data.systems)
                return (
                  <button
                    key={faction}
                    onClick={() => setSelectedFaction(faction)}
                    className={`p-3 rounded-lg border text-left transition-all hover:scale-[1.01] ${
                      data.isLawful 
                        ? 'bg-green-950/30 border-green-500/30 hover:border-green-500/50'
                        : 'bg-red-950/30 border-red-500/30 hover:border-red-500/50'
                    }`}
                  >
                    <h4 className={`font-medium ${data.isLawful ? 'text-green-300' : 'text-red-400'}`}>
                      {faction}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {systemsArray.map(sys => (
                        <span
                          key={sys}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${SYSTEM_COLORS[sys].bg} ${SYSTEM_COLORS[sys].border} ${SYSTEM_COLORS[sys].text}`}
                        >
                          {SYSTEM_LABELS[sys]}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {data.pools.length} mission pool{data.pools.length !== 1 ? 's' : ''} with blueprints
                    </p>
                  </button>
                )
              })}
          </div>
        </>
      )}

      {/* Mission Pool Selection (Faction View) */}
      {viewMode === 'faction' && selectedFaction && !selectedMissionPool && (
        <div className="space-y-2">
          {poolsByFaction[selectedFaction]?.pools
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map(pool => {
              const poolBps = missionBlueprints[pool.key] || []
              const acquiredCount = poolBps.filter(bp => {
                const bpName = bp.name.toLowerCase()
                const fullBp = blueprintsByInternalName[bpName]
                return fullBp && acquiredBlueprints[fullBp.file]
              }).length
              const colors = SYSTEM_COLORS[pool.system]
              
              return (
                <button
                  key={pool.key}
                  onClick={() => setSelectedMissionPool(pool.key)}
                  className={`w-full p-3 rounded-lg border text-left transition-all hover:bg-slate-800/50 ${
                    pool.isLawful 
                      ? 'border-green-500/20 hover:border-green-500/40'
                      : 'border-red-500/20 hover:border-red-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium text-sm ${pool.isLawful ? 'text-green-300' : 'text-red-400'}`}>
                          {pool.displayName}
                        </h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors.bg} ${colors.border} ${colors.text}`}>
                          {SYSTEM_LABELS[pool.system]}
                        </span>
                      </div>
                      {!pool.isLawful && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-950/50 text-red-400 border border-red-500/40 rounded mt-1 inline-block">
                          Illegal
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-sm font-medium ${
                        acquiredCount === poolBps.length ? 'text-green-400' : 'text-amber-400'
                      }`}>
                        {acquiredCount}/{poolBps.length}
                      </span>
                      <p className="text-[10px] text-slate-500">blueprints</p>
                    </div>
                  </div>
                </button>
              )
            })}
        </div>
      )}

      {/* ========== SHARED: Blueprint Pool View ========== */}
      
      {/* Blueprint Pool View */}
      {selectedMissionPool && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Blueprints in this mission pool</p>
              <p className="text-lg font-semibold">
                <span className={poolStats.acquired === poolStats.total ? 'text-green-400' : 'text-amber-400'}>
                  {poolStats.acquired}
                </span>
                <span className="text-slate-500">/{poolStats.total}</span>
                <span className="text-slate-500 text-sm ml-2">acquired</span>
              </p>
            </div>
            <button
              onClick={handleBack}
              className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg"
            >
              ← Back
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedPoolBlueprints.map(bp => (
              <div
                key={bp.name}
                className={`p-3 rounded-lg border transition-all ${
                  bp.isAcquired
                    ? 'bg-green-950/20 border-green-500/20 opacity-60'
                    : bp.isTracked
                      ? 'bg-amber-950/30 border-amber-500/30'
                      : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      bp.isAcquired ? 'text-green-400 line-through' : 'text-white'
                    }`}>
                      {bp.displayName}
                    </p>
                    {bp.isAcquired && (
                      <span className="text-[10px] text-green-500">Acquired</span>
                    )}
                    {bp.isTracked && !bp.isAcquired && (
                      <span className="text-[10px] text-amber-400">On tracker</span>
                    )}
                  </div>
                  {!bp.isAcquired && !bp.isTracked && bp.fullBlueprint && (
                    <button
                      onClick={() => onAddToTracker(bp.fullBlueprint!.file)}
                      className="shrink-0 px-2 py-1 text-[10px] font-medium text-amber-300 border border-amber-500/40 rounded hover:bg-amber-950/40 transition-colors"
                    >
                      Track
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
