import React, { useState, useMemo } from 'react'
import blueprintMissionData from '../data/game-blueprint-missions.json'
import { useBlueprintData } from '../routes/blueprints'
import { getRegionInfo } from '../lib/missionConstants'

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

type MissionEntry = {
  title: string
  titleKey: string
  faction: string
  system: string
  region: string | null
  category: string | null
  minStanding: { name: string; minReputation: number } | null
  maxStanding: { name: string; minReputation: number } | null
  repPoints: number
}

type System = 'stanton' | 'pyro' | 'nyx' | 'unknown'

type ViewMode = 'system' | 'faction'

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

const UNLAWFUL_FACTIONS = [
  'headhunters', 'xenothreat', 'ruto', 'vaughn', 'ninetails',
  'tarpits', 'bitzeros', 'dead saints'
]

function isUnlawfulFaction(faction: string): boolean {
  const lower = faction.toLowerCase()
  return UNLAWFUL_FACTIONS.some(f => lower.includes(f))
}

function normalizeSystem(sys: string | undefined): System {
  if (!sys) return 'unknown'
  const lower = sys.toLowerCase()
  if (lower === 'stanton') return 'stanton'
  if (lower === 'pyro') return 'pyro'
  if (lower === 'nyx') return 'nyx'
  return 'unknown'
}

interface MissionDisplay {
  poolKey: string
  title: string
  faction: string
  system: System
  region: string | null
  category: string | null
  isLawful: boolean
  minStanding: { name: string; minReputation: number } | null
  blueprintCount: number
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
  const [selectedMission, setSelectedMission] = useState<MissionDisplay | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const missionBlueprints = blueprintMissionData.missionBlueprints as Record<string, MissionPoolBlueprint[]>
  const missionsByPool = blueprintMissionData.missionsByPool as Record<string, MissionEntry[]>

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

  // Build list of missions with actual titles from missionsByPool
  const missions = useMemo((): MissionDisplay[] => {
    const result: MissionDisplay[] = []
    const seen = new Set<string>()
    
    for (const [poolKey, missionEntries] of Object.entries(missionsByPool)) {
      // Get blueprint count for this pool
      const bps = missionBlueprints[poolKey] || missionBlueprints[poolKey.toLowerCase()] || []
      if (bps.length === 0) continue
      
      for (const mission of missionEntries) {
        // Skip placeholder/unlocalized titles
        if (!mission.title || 
            mission.title.includes('~mission') || 
            mission.title.startsWith('@') ||
            mission.title.includes('UNINITIALIZED') ||
            mission.title.includes('PLACEHOLDER')) continue
        
        // Dedupe by title + faction + system (same mission can appear in multiple systems)
        const dedupeKey = `${mission.title}|${mission.faction}|${mission.system || 'unknown'}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        
        result.push({
          poolKey,
          title: mission.title,
          faction: mission.faction || 'Unknown',
          system: normalizeSystem(mission.system),
          region: mission.region,
          category: mission.category,
          isLawful: !isUnlawfulFaction(mission.faction || ''),
          minStanding: mission.minStanding,
          blueprintCount: bps.length,
        })
      }
    }
    
    return result.sort((a, b) => a.title.localeCompare(b.title))
  }, [missionsByPool, missionBlueprints])

  const systemStats = useMemo(() => {
    const stats: Record<System, { factions: Set<string>; missions: number }> = {
      stanton: { factions: new Set(), missions: 0 },
      pyro: { factions: new Set(), missions: 0 },
      nyx: { factions: new Set(), missions: 0 },
      unknown: { factions: new Set(), missions: 0 },
    }
    
    for (const m of missions) {
      stats[m.system].factions.add(m.faction)
      stats[m.system].missions++
    }
    
    return stats
  }, [missions])

  const missionsBySystem = useMemo(() => {
    const map: Record<System, Record<string, MissionDisplay[]>> = {
      stanton: {},
      pyro: {},
      nyx: {},
      unknown: {},
    }
    
    for (const m of missions) {
      if (!map[m.system][m.faction]) {
        map[m.system][m.faction] = []
      }
      map[m.system][m.faction].push(m)
    }
    
    return map
  }, [missions])

  const missionsByFaction = useMemo(() => {
    const map: Record<string, { missions: MissionDisplay[]; isLawful: boolean; systems: Set<System> }> = {}
    
    for (const m of missions) {
      if (!map[m.faction]) {
        map[m.faction] = { missions: [], isLawful: m.isLawful, systems: new Set() }
      }
      map[m.faction].missions.push(m)
      map[m.faction].systems.add(m.system)
    }
    
    return map
  }, [missions])

  const filteredFactions = useMemo(() => {
    if (!selectedSystem) return {}
    const factions = missionsBySystem[selectedSystem]
    
    if (!searchTerm) return factions
    
    const term = searchTerm.toLowerCase()
    const filtered: Record<string, MissionDisplay[]> = {}
    for (const [faction, missionList] of Object.entries(factions)) {
      const matching = missionList.filter(m => 
        m.title.toLowerCase().includes(term) ||
        faction.toLowerCase().includes(term) ||
        (m.category && m.category.toLowerCase().includes(term))
      )
      if (matching.length > 0) {
        filtered[faction] = matching
      }
    }
    return filtered
  }, [selectedSystem, missionsBySystem, searchTerm])

  const filteredFactionList = useMemo(() => {
    const entries = Object.entries(missionsByFaction)
    
    if (!searchTerm) return entries
    
    const term = searchTerm.toLowerCase()
    return entries.filter(([faction, data]) => 
      faction.toLowerCase().includes(term) ||
      data.missions.some(m => m.title.toLowerCase().includes(term) || (m.category && m.category.toLowerCase().includes(term)))
    )
  }, [missionsByFaction, searchTerm])

  const selectedFactionMissions = useMemo((): MissionDisplay[] => {
    if (viewMode === 'system' && selectedSystem && selectedFaction) {
      return missionsBySystem[selectedSystem][selectedFaction] || []
    }
    if (viewMode === 'faction' && selectedFaction) {
      return missionsByFaction[selectedFaction]?.missions || []
    }
    return []
  }, [viewMode, selectedSystem, selectedFaction, missionsBySystem, missionsByFaction])

  const selectedMissionBlueprints = useMemo(() => {
    if (!selectedMission) return []
    
    const poolBps = missionBlueprints[selectedMission.poolKey] || missionBlueprints[selectedMission.poolKey.toLowerCase()] || []
    
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
  }, [selectedMission, missionBlueprints, blueprintsByInternalName, acquiredBlueprints, isOnTargetList])

  const blueprintStats = useMemo(() => {
    const total = selectedMissionBlueprints.length
    const acquired = selectedMissionBlueprints.filter(b => b.isAcquired).length
    return { total, acquired }
  }, [selectedMissionBlueprints])

  const handleBack = () => {
    if (selectedMission) {
      setSelectedMission(null)
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
    setSelectedMission(null)
    setSearchTerm('')
  }

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick: () => void }[] = []
    
    if (viewMode === 'system') {
      crumbs.push({ label: 'Systems', onClick: () => { setSelectedSystem(null); setSelectedFaction(null); setSelectedMission(null) } })
      
      if (selectedSystem) {
        crumbs.push({
          label: SYSTEM_LABELS[selectedSystem],
          onClick: () => { setSelectedFaction(null); setSelectedMission(null) },
        })
      }
      
      if (selectedFaction) {
        crumbs.push({
          label: selectedFaction,
          onClick: () => { setSelectedMission(null) },
        })
      }
    } else {
      crumbs.push({ label: 'Factions', onClick: () => { setSelectedFaction(null); setSelectedMission(null) } })
      
      if (selectedFaction) {
        crumbs.push({
          label: selectedFaction,
          onClick: () => { setSelectedMission(null) },
        })
      }
    }
    
    if (selectedMission) {
      crumbs.push({
        label: selectedMission.title.length > 40 ? selectedMission.title.slice(0, 40) + '...' : selectedMission.title,
        onClick: () => {},
      })
    }
    
    return crumbs
  }, [viewMode, selectedSystem, selectedFaction, selectedMission])

  const renderMissionCard = (mission: MissionDisplay) => {
    const poolBps = missionBlueprints[mission.poolKey] || missionBlueprints[mission.poolKey.toLowerCase()] || []
    const acquiredCount = poolBps.filter(bp => {
      const bpName = bp.name.toLowerCase()
      const fullBp = blueprintsByInternalName[bpName]
      return fullBp && acquiredBlueprints[fullBp.file]
    }).length
    
    const regionInfo = mission.region && mission.system === 'pyro' 
      ? getRegionInfo('pyro', mission.region)
      : null
    
    return (
      <button
        key={`${mission.poolKey}-${mission.title}`}
        onClick={() => setSelectedMission(mission)}
        className={`w-full p-3 rounded-lg border text-left transition-all hover:bg-slate-800/50 ${
          mission.isLawful 
            ? 'border-green-500/20 hover:border-green-500/40'
            : 'border-red-500/20 hover:border-red-500/40'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className={`font-medium text-sm ${mission.isLawful ? 'text-green-300' : 'text-red-400'}`}>
              {mission.title}
            </h4>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {!mission.isLawful && (
                <span className="text-[10px] px-1.5 py-0.5 bg-red-950/50 text-red-400 border border-red-500/40 rounded">
                  Illegal
                </span>
              )}
              {mission.category && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-950/50 text-amber-300 border border-amber-500/40 rounded">
                  {mission.category}
                </span>
              )}
              {mission.region && (
                <span 
                  className="text-[10px] px-1.5 py-0.5 bg-violet-950/50 text-violet-300 border border-violet-500/40 rounded cursor-help"
                  title={regionInfo ? `${regionInfo.label}\nLocations: ${regionInfo.locations.join(', ')}` : undefined}
                >
                  {SYSTEM_LABELS[mission.system]} {mission.region}
                </span>
              )}
              {mission.minStanding && mission.minStanding.minReputation > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950/50 text-cyan-300 border border-cyan-500/40 rounded">
                  {mission.minStanding.name} ({mission.minStanding.minReputation.toLocaleString()})
                </span>
              )}
            </div>
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
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumbs + View Toggle */}
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
        
        {!selectedFaction && !selectedMission && (
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
            if (stats.missions === 0) return null
            
            return (
              <button
                key={system}
                onClick={() => setSelectedSystem(system)}
                className={`p-4 rounded-xl border transition-all hover:scale-[1.02] ${colors.bg} ${colors.border}`}
              >
                <h3 className={`text-lg font-semibold ${colors.text}`}>{SYSTEM_LABELS[system]}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {stats.factions.size} faction{stats.factions.size !== 1 ? 's' : ''} • {stats.missions} mission{stats.missions !== 1 ? 's' : ''}
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
              placeholder="Search missions, factions, or categories..."
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
              .map(([faction, missionList]) => {
                const isLawful = !isUnlawfulFaction(faction)
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
                      {missionList.length} mission{missionList.length !== 1 ? 's' : ''} with blueprints
                    </p>
                  </button>
                )
              })}
          </div>
        </>
      )}

      {/* Mission Selection (System View) */}
      {viewMode === 'system' && selectedSystem && selectedFaction && !selectedMission && (
        <div className="space-y-2">
          {selectedFactionMissions.map(mission => renderMissionCard(mission))}
        </div>
      )}

      {/* ========== FACTION VIEW ========== */}
      
      {/* Faction List (Faction View) */}
      {viewMode === 'faction' && !selectedFaction && (
        <>
          <div className="relative">
            <input
              type="text"
              placeholder="Search missions, factions, or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="site-input w-full pl-9 pr-4 py-2 text-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFactionList
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
                      {data.missions.length} mission{data.missions.length !== 1 ? 's' : ''} with blueprints
                    </p>
                  </button>
                )
              })}
          </div>
        </>
      )}

      {/* Mission Selection (Faction View) */}
      {viewMode === 'faction' && selectedFaction && !selectedMission && (
        <div className="space-y-2">
          {selectedFactionMissions
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(mission => renderMissionCard(mission))}
        </div>
      )}

      {/* ========== SHARED: Blueprint View ========== */}
      
      {/* Blueprint View */}
      {selectedMission && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Blueprints from this mission</p>
              <p className="text-lg font-semibold">
                <span className={blueprintStats.acquired === blueprintStats.total ? 'text-green-400' : 'text-amber-400'}>
                  {blueprintStats.acquired}
                </span>
                <span className="text-slate-500">/{blueprintStats.total}</span>
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
            {selectedMissionBlueprints.map(bp => (
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
