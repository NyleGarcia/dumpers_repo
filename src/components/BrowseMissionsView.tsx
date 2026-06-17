import React, { useState, useMemo } from 'react'
import reputationData from '../data/game-reputation.json'
import blueprintMissionData from '../data/game-blueprint-missions.json'
import { useBlueprintData } from '../routes/blueprints'

type BlueprintRecord = {
  file: string
  internalName?: string
  blueprintName?: string
  [key: string]: unknown
}

type MissionEntry = {
  label: string
  title: string
  faction: string
  missionGiver: string
  missionType: string
  isLawful: boolean
  notForRelease: boolean
  locations: string[]
  aUecReward: { min: number; max: number }
  hasBlueprintReward: boolean
}

type MissionWithKey = MissionEntry & { key: string; system: System }

type MissionPoolBlueprint = {
  name: string
  weight: number
  path: string
}

type System = 'stanton' | 'pyro' | 'nyx' | 'unknown'

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

const FACTION_DISPLAY_NAMES: Record<string, string> = {
  lawful_bountyhuntersguild: 'Bounty Hunters Guild',
  lawful_crusadersecurity: 'Crusader Security',
  lawful_hurstonsecurity: 'Hurston Security',
  lawful_microtech: 'microTech',
  lawful_citizensforprosperity: 'Citizens for Prosperity',
  lawful_adagioholdings: 'Adagio Holdings',
  lawful_covalexshipping: 'Covalex',
  lawful_shubininterstellar: 'Shubin Interstellar',
  lawful_mt_protectionservices: 'MT Protection Services',
  unlawful_ninetails: 'Nine Tails',
  unlawful_headhunters: 'Headhunters',
  unlawful_xeno_threat: 'Xenothreat',
  cdf: 'Civilian Defense Force',
  arccorp: 'ArcCorp',
}

function getFactionDisplayName(factionKey: string): string {
  return FACTION_DISPLAY_NAMES[factionKey] || factionKey.replace(/_/g, ' ').replace(/lawful |unlawful /gi, '')
}

function getSystemFromLocations(locations: string[]): System {
  if (!locations.length) return 'unknown'
  
  const systems = new Set<System>()
  for (const loc of locations) {
    const l = loc.toLowerCase()
    if (l.includes('stanton') || l.includes('crusader') || l.includes('hurston') || l.includes('microtech') || l.includes('arccorp')) {
      systems.add('stanton')
    } else if (l.includes('pyro')) {
      systems.add('pyro')
    } else if (l.includes('nyx')) {
      systems.add('nyx')
    }
  }
  
  if (systems.size === 0) return 'unknown'
  if (systems.size === 1) return [...systems][0]
  return 'unknown'
}

function getSystemFromFaction(factionKey: string): System {
  const f = factionKey.toLowerCase()
  if (f.includes('crusader') || f.includes('hurston') || f.includes('microtech') || f.includes('arccorp') || f.includes('covalex') || f.includes('shubin')) {
    return 'stanton'
  }
  if (f.includes('citizensforprosperity') || f.includes('headhunters')) {
    return 'pyro'
  }
  return 'unknown'
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
  const [selectedSystem, setSelectedSystem] = useState<System | null>(null)
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null)
  const [selectedMissionPool, setSelectedMissionPool] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const missions = reputationData.missions as Record<string, MissionEntry>
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

  const missionsWithBlueprints = useMemo(() => {
    return Object.entries(missions)
      .filter(([_, m]) => m.hasBlueprintReward && !m.notForRelease)
      .map(([key, m]) => ({
        key,
        ...m,
        system: getSystemFromLocations(m.locations) !== 'unknown' 
          ? getSystemFromLocations(m.locations) 
          : getSystemFromFaction(m.faction),
      }))
  }, [missions])

  const systemStats = useMemo(() => {
    const stats: Record<System, { factions: Set<string>; missions: number }> = {
      stanton: { factions: new Set(), missions: 0 },
      pyro: { factions: new Set(), missions: 0 },
      nyx: { factions: new Set(), missions: 0 },
      unknown: { factions: new Set(), missions: 0 },
    }
    
    for (const m of missionsWithBlueprints) {
      stats[m.system].factions.add(m.faction)
      stats[m.system].missions++
    }
    
    return stats
  }, [missionsWithBlueprints])

  const factionsBySystem = useMemo(() => {
    const map: Record<System, Record<string, MissionWithKey[]>> = {
      stanton: {},
      pyro: {},
      nyx: {},
      unknown: {},
    }
    
    for (const m of missionsWithBlueprints) {
      if (!map[m.system][m.faction]) {
        map[m.system][m.faction] = []
      }
      map[m.system][m.faction].push(m)
    }
    
    return map
  }, [missionsWithBlueprints])

  const filteredFactions = useMemo(() => {
    if (!selectedSystem) return {}
    const factions = factionsBySystem[selectedSystem]
    
    if (!searchTerm) return factions
    
    const term = searchTerm.toLowerCase()
    const filtered: Record<string, MissionWithKey[]> = {}
    for (const [faction, missions] of Object.entries(factions)) {
      const matchingMissions = missions.filter(m => 
        m.title.toLowerCase().includes(term) ||
        getFactionDisplayName(faction).toLowerCase().includes(term)
      )
      if (matchingMissions.length > 0) {
        filtered[faction] = matchingMissions
      }
    }
    return filtered
  }, [selectedSystem, factionsBySystem, searchTerm])

  const selectedFactionMissions = useMemo((): MissionWithKey[] => {
    if (!selectedSystem || !selectedFaction) return []
    return factionsBySystem[selectedSystem][selectedFaction] || []
  }, [selectedSystem, selectedFaction, factionsBySystem])

  const selectedPoolBlueprints = useMemo(() => {
    if (!selectedMissionPool) return []
    
    const poolKey = selectedMissionPool
    const poolBps = missionBlueprints[poolKey] || []
    
    return poolBps.map(bp => {
      const bpName = bp.name.toLowerCase()
      const fullBp = blueprintsByInternalName[bpName]
      const isAcquired = fullBp ? !!acquiredBlueprints[fullBp.file] : false
      const isTracked = fullBp ? isOnTargetList(fullBp.file) : false
      
      return {
        ...bp,
        fullBlueprint: fullBp,
        displayName: fullBp?.blueprintName || bp.name.replace(/_/g, ' '),
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

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick: () => void }[] = [
      { label: 'Systems', onClick: () => { setSelectedSystem(null); setSelectedFaction(null); setSelectedMissionPool(null) } },
    ]
    
    if (selectedSystem) {
      crumbs.push({
        label: SYSTEM_LABELS[selectedSystem],
        onClick: () => { setSelectedFaction(null); setSelectedMissionPool(null) },
      })
    }
    
    if (selectedFaction) {
      crumbs.push({
        label: getFactionDisplayName(selectedFaction),
        onClick: () => { setSelectedMissionPool(null) },
      })
    }
    
    if (selectedMissionPool) {
      const mission = missions[selectedMissionPool]
      crumbs.push({
        label: mission?.title || selectedMissionPool,
        onClick: () => {},
      })
    }
    
    return crumbs
  }, [selectedSystem, selectedFaction, selectedMissionPool, missions])

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
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

      {/* System Selection */}
      {!selectedSystem && (
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
                  {stats.factions.size} faction{stats.factions.size !== 1 ? 's' : ''} • {stats.missions} mission pool{stats.missions !== 1 ? 's' : ''}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Faction Selection */}
      {selectedSystem && !selectedFaction && (
        <>
          <div className="relative">
            <input
              type="text"
              placeholder="Search factions or missions..."
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
              .sort(([a], [b]) => getFactionDisplayName(a).localeCompare(getFactionDisplayName(b)))
              .map(([faction, missions]) => {
                const isLawful = !faction.includes('unlawful')
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
                      {getFactionDisplayName(faction)}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {missions.length} mission pool{missions.length !== 1 ? 's' : ''} with blueprints
                    </p>
                  </button>
                )
              })}
          </div>
        </>
      )}

      {/* Mission Pool Selection */}
      {selectedSystem && selectedFaction && !selectedMissionPool && (
        <div className="space-y-2">
          {selectedFactionMissions.map(mission => {
            const poolKey = mission.key
            const poolBps = missionBlueprints[poolKey] || []
            const acquiredCount = poolBps.filter(bp => {
              const bpName = bp.name.toLowerCase()
              const fullBp = blueprintsByInternalName[bpName]
              return fullBp && acquiredBlueprints[fullBp.file]
            }).length
            
            return (
              <button
                key={mission.key}
                onClick={() => setSelectedMissionPool(mission.key)}
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
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {!mission.isLawful && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-950/50 text-red-400 border border-red-500/40 rounded">
                          Illegal
                        </span>
                      )}
                      {mission.aUecReward.min > 0 && (
                        <span className="text-[10px] text-yellow-400">
                          {mission.aUecReward.min.toLocaleString()} aUEC
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
          })}
        </div>
      )}

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
