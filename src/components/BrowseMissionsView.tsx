import React, { useEffect, useMemo, useState } from 'react'
import { useBlueprintData } from '../routes/blueprints'
import MissionLocationTags from './MissionLocationTags'
import { getBrowseSystemsForMission } from '../lib/missionLocations'
import type { Region } from '../lib/missions'
import { getContractMissionBrowseCatalog, type ContractMissionBrowseEntry } from '../lib/blueprintMissionRewards'
import {
  formatBlueprintDropChance,
  formatRepReward,
  formatStandingRange,
} from '../lib/missionAcquisition'
import {
  makeBrowseMissionKey,
  readMissionTrackerUiState,
  writeMissionTrackerUiState,
  type BrowseSystem,
} from '../lib/missionTrackerUiState'

type BlueprintRecord = {
  file: string
  internalName?: string
  blueprintName?: string
  [key: string]: unknown
}

type MissionDisplay = ContractMissionBrowseEntry & {
  blueprintCount: number
}

const SYSTEM_LABELS: Record<BrowseSystem, string> = {
  stanton: 'Stanton',
  pyro: 'Pyro',
  nyx: 'Nyx',
  unknown: 'Unknown Location',
}

const SYSTEM_COLORS: Record<BrowseSystem, { bg: string; border: string; text: string }> = {
  stanton: { bg: 'bg-blue-950/50', border: 'border-blue-500/40', text: 'text-blue-300' },
  pyro: { bg: 'bg-orange-950/50', border: 'border-orange-500/40', text: 'text-orange-300' },
  nyx: { bg: 'bg-purple-950/50', border: 'border-purple-500/40', text: 'text-purple-300' },
  unknown: { bg: 'bg-slate-800/50', border: 'border-slate-600/40', text: 'text-slate-400' },
}

interface MissionGroup {
  title: string
  isLawful: boolean
  category: string | null
  variants: MissionDisplay[]
}

interface BrowseMissionsViewProps {
  acquiredBlueprints: Record<string, boolean>
  onAddToTracker: (blueprintId: string) => void
  isOnTargetList: (blueprintId: string) => boolean
}

function getMissionBrowseSystems(mission: Pick<MissionDisplay, 'poolKeys' | 'system' | 'region'>): BrowseSystem[] {
  return getBrowseSystemsForMission({
    poolKey: mission.poolKeys[0] ?? '',
    system: mission.system,
    subRegion: mission.region,
  })
}

function groupMissionsByTitle(missions: MissionDisplay[]): MissionGroup[] {
  const map = new Map<string, MissionGroup>()

  for (const mission of missions) {
    const existing = map.get(mission.title)
    if (existing) {
      existing.variants.push(mission)
      existing.isLawful = existing.isLawful && mission.isLawful
    } else {
      map.set(mission.title, {
        title: mission.title,
        isLawful: mission.isLawful,
        category: mission.category,
        variants: [mission],
      })
    }
  }

  for (const group of map.values()) {
    group.variants.sort((a, b) => {
      const regionCompare = (a.region || '').localeCompare(b.region || '')
      if (regionCompare !== 0) return regionCompare
      const repCompare = (a.minStanding?.minReputation ?? 0) - (b.minStanding?.minReputation ?? 0)
      if (repCompare !== 0) return repCompare
      return (a.poolKeys[0] || '').localeCompare(b.poolKeys[0] || '')
    })
  }

  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title))
}

export default function BrowseMissionsView({
  acquiredBlueprints,
  onAddToTracker,
  isOnTargetList,
}: BrowseMissionsViewProps) {
  const { data: blueprints = [] } = useBlueprintData()
  const [selectedFaction, setSelectedFaction] = useState<string | null>(
    () => readMissionTrackerUiState().browse.selectedFaction
  )
  const [selectedMissionKey, setSelectedMissionKey] = useState<string | null>(
    () => readMissionTrackerUiState().browse.selectedMissionKey
  )
  const [searchTerm, setSearchTerm] = useState(() => readMissionTrackerUiState().browse.searchTerm)

  const missions = useMemo((): MissionDisplay[] => {
    return getContractMissionBrowseCatalog().map((contract) => ({
      ...contract,
      blueprintCount: contract.blueprints.length,
    }))
  }, [])

  const blueprintsByInternalName = useMemo(() => {
    const map: Record<string, BlueprintRecord> = {}
    for (const bp of blueprints as BlueprintRecord[]) {
      if (bp.internalName) {
        map[bp.internalName.toLowerCase()] = bp
      }
      if (bp.file) {
        map[bp.file.toLowerCase()] = bp
      }
      const fileMatch = bp.file?.match(/bp_craft_([^/\\]+?)(?:_scitem)?\.json$/i)
      if (fileMatch) {
        map[fileMatch[1].toLowerCase()] = bp
      }
    }
    return map
  }, [blueprints])

  const missionsByFaction = useMemo(() => {
    const map: Record<string, { missions: MissionDisplay[]; isLawful: boolean; systems: Set<BrowseSystem> }> = {}

    for (const m of missions) {
      if (!map[m.faction]) {
        map[m.faction] = { missions: [], isLawful: true, systems: new Set() }
      }
      map[m.faction].missions.push(m)
      if (!m.isLawful) map[m.faction].isLawful = false
      for (const system of getMissionBrowseSystems(m)) {
        map[m.faction].systems.add(system)
      }
    }

    return map
  }, [missions])

  const selectedMission = useMemo(() => {
    if (!selectedMissionKey) return null
    return missions.find((mission) => makeBrowseMissionKey(mission) === selectedMissionKey) ?? null
  }, [missions, selectedMissionKey])

  useEffect(() => {
    writeMissionTrackerUiState({
      browse: {
        selectedFaction,
        selectedMissionKey,
        searchTerm,
      },
    })
  }, [selectedFaction, selectedMissionKey, searchTerm])

  const filteredFactionList = useMemo(() => {
    const entries = Object.entries(missionsByFaction)

    if (!searchTerm) return entries

    const term = searchTerm.toLowerCase()
    return entries.filter(([faction, data]) =>
      faction.toLowerCase().includes(term) ||
      data.missions.some(m =>
        m.title.toLowerCase().includes(term) ||
        (m.category && m.category.toLowerCase().includes(term))
      )
    )
  }, [missionsByFaction, searchTerm])

  const selectedFactionMissionGroups = useMemo((): MissionGroup[] => {
    if (!selectedFaction) return []
    const factionMissions = missionsByFaction[selectedFaction]?.missions || []

    let filtered = factionMissions
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = factionMissions.filter(m =>
        m.title.toLowerCase().includes(term) ||
        (m.category && m.category.toLowerCase().includes(term))
      )
    }

    return groupMissionsByTitle(filtered)
  }, [selectedFaction, missionsByFaction, searchTerm])

  const getMissionBlueprintStats = (mission: MissionDisplay) => {
    const acquiredCount = mission.blueprints.filter((bp) => {
      const fullBp = blueprintsByInternalName[bp.name.toLowerCase()]
      return fullBp && acquiredBlueprints[fullBp.internalName]
    }).length
    return { acquiredCount, total: mission.blueprints.length }
  }

  const selectedMissionBlueprints = useMemo(() => {
    if (!selectedMission) return []

    return selectedMission.blueprints.map((bp) => {
      const bpName = bp.name.toLowerCase()
      const fullBp = blueprintsByInternalName[bpName]
      const isAcquired = fullBp ? !!acquiredBlueprints[fullBp.internalName] : false
      const isTracked = fullBp ? isOnTargetList(fullBp.internalName) : false

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
  }, [selectedMission, blueprintsByInternalName, acquiredBlueprints, isOnTargetList])

  const blueprintStats = useMemo(() => {
    const total = selectedMissionBlueprints.length
    const acquired = selectedMissionBlueprints.filter(b => b.isAcquired).length
    return { total, acquired }
  }, [selectedMissionBlueprints])

  const handleBack = () => {
    if (selectedMissionKey) {
      setSelectedMissionKey(null)
    } else if (selectedFaction) {
      setSelectedFaction(null)
    }
  }

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick: () => void }[] = [
      { label: 'Factions', onClick: () => { setSelectedFaction(null); setSelectedMissionKey(null) } },
    ]

    if (selectedFaction) {
      crumbs.push({
        label: selectedFaction,
        onClick: () => { setSelectedMissionKey(null) },
      })
    }

    if (selectedMission) {
      crumbs.push({
        label: selectedMission.title.length > 40 ? selectedMission.title.slice(0, 40) + '...' : selectedMission.title,
        onClick: () => {},
      })
    }

    return crumbs
  }, [selectedFaction, selectedMission])

  const renderMissionTags = (mission: MissionDisplay) => {
    const systemRegion = mission.system?.toLowerCase()
    const regions: Region[] =
      systemRegion === 'stanton' || systemRegion === 'pyro' || systemRegion === 'nyx'
        ? [systemRegion]
        : []

    const standingLabel = formatStandingRange(mission.minStanding, mission.maxStanding)
    const repText = formatRepReward(mission.repPoints, mission.repPoints)
    const poolRollText =
      mission.hasPartialPoolRoll && mission.minPoolChance < 1
        ? `${Math.round(mission.minPoolChance * 100)}% pool roll`
        : null

    return (
      <>
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
        <MissionLocationTags
          regions={regions}
          subRegion={mission.region}
          system={mission.system}
          poolKey={mission.poolKeys[0]}
        />
        {standingLabel && (
          <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950/50 text-cyan-300 border border-cyan-500/40 rounded">
            {standingLabel}
          </span>
        )}
        {repText && (
          <span className="text-[10px] text-emerald-400/90">{repText}</span>
        )}
        {poolRollText && (
          <span className="text-[10px] text-amber-400/80">{poolRollText}</span>
        )}
      </>
    )
  }

  const renderVariantRow = (mission: MissionDisplay) => {
    const { acquiredCount, total } = getMissionBlueprintStats(mission)

    return (
      <button
        key={mission.entryKey}
        onClick={() => setSelectedMissionKey(makeBrowseMissionKey(mission))}
        className="w-full px-3 py-2.5 text-left transition-all hover:bg-slate-800/50 flex items-start justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {renderMissionTags(mission)}
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-sm font-medium ${
            acquiredCount === total ? 'text-green-400' : 'text-amber-400'
          }`}>
            {acquiredCount}/{total}
          </span>
          <p className="text-[10px] text-slate-500">blueprints</p>
        </div>
      </button>
    )
  }

  const renderMissionGroup = (group: MissionGroup) => {
    if (group.variants.length === 1) {
      const mission = group.variants[0]
      const { acquiredCount, total } = getMissionBlueprintStats(mission)

      return (
        <button
          key={mission.entryKey}
          onClick={() => setSelectedMissionKey(makeBrowseMissionKey(mission))}
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
                {renderMissionTags(mission)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className={`text-sm font-medium ${
                acquiredCount === total ? 'text-green-400' : 'text-amber-400'
              }`}>
                {acquiredCount}/{total}
              </span>
              <p className="text-[10px] text-slate-500">blueprints</p>
            </div>
          </div>
        </button>
      )
    }

    return (
      <div
        key={group.title}
        className={`rounded-lg border overflow-hidden ${
          group.isLawful ? 'border-green-500/20' : 'border-red-500/20'
        }`}
      >
        <div className={`px-3 py-2.5 border-b ${
          group.isLawful ? 'border-green-500/10 bg-green-950/10' : 'border-red-500/10 bg-red-950/10'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className={`font-medium text-sm ${group.isLawful ? 'text-green-300' : 'text-red-400'}`}>
                {group.title}
              </h4>
              {group.category && (
                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-amber-950/50 text-amber-300 border border-amber-500/40 rounded">
                  {group.category}
                </span>
              )}
            </div>
            <span className="shrink-0 text-[10px] text-slate-500 pt-0.5">
              {group.variants.length} variant{group.variants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-800/80">
          {group.variants.map(mission => renderVariantRow(mission))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
        <>
          <div className="relative">
            <input
              type="text"
              placeholder="Search missions or factions..."
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
                const uniqueTitles = new Set(data.missions.map(m => m.title)).size
                const contractCount = data.missions.length
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
                      {uniqueTitles} mission type{uniqueTitles !== 1 ? 's' : ''} · {contractCount} contract variant{contractCount !== 1 ? 's' : ''}
                    </p>
                  </button>
                )
              })}
          </div>
        </>
      )}

      {selectedFaction && !selectedMission && (
        <>
          <div className="relative">
            <input
              type="text"
              placeholder="Search missions in this faction..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="site-input w-full pl-9 pr-4 py-2 text-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="space-y-2">
            {selectedFactionMissionGroups.map(group => renderMissionGroup(group))}
          </div>
        </>
      )}

      {selectedMission && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className={`text-base font-semibold ${selectedMission.isLawful ? 'text-green-300' : 'text-red-400'}`}>
                {selectedMission.title}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {renderMissionTags(selectedMission)}
              </div>
              <p className="text-sm text-slate-400 mt-3">
                Blueprint rewards from this contract
              </p>
              <p className="text-lg font-semibold mt-0.5">
                <span className={blueprintStats.acquired === blueprintStats.total ? 'text-green-400' : 'text-amber-400'}>
                  {blueprintStats.acquired}
                </span>
                <span className="text-slate-500">/{blueprintStats.total}</span>
                <span className="text-slate-500 text-sm ml-2">acquired</span>
              </p>
            </div>
            <button
              onClick={handleBack}
              className="shrink-0 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg"
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
                    {!bp.isAcquired && formatBlueprintDropChance(bp.dropChance) && (
                      <span className="text-[10px] text-amber-400/80">
                        {formatBlueprintDropChance(bp.dropChance)}
                      </span>
                    )}
                  </div>
                  {!bp.isAcquired && !bp.isTracked && bp.fullBlueprint && (
                    <button
                      onClick={() => onAddToTracker(bp.fullBlueprint!.internalName)}
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
