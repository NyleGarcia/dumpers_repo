import React, { useCallback, useMemo, useState } from 'react'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import { useBlueprintData } from './blueprints'
import { useAuth } from '../contexts/AuthContext'
import { useBlueprintOrderOverrides } from '../hooks/useBlueprintOrderOverrides'
import { useTargetList } from '../hooks/useTargetList'
import { resolveIsOrderable } from '../lib/blueprintOrderable'
import { buildMissionList, getMissionsForBlueprint, missionKey, type Region } from '../lib/missions'
import {
  formatBlueprintUnlockBadge,
  formatRepReward,
  getBlueprintUnlockInfo,
} from '../lib/missionAcquisition'
import BrowseMissionsView from '../components/BrowseMissionsView'

type ViewMode = 'tracker' | 'browse'

function formatDropChance(chance: number | null | undefined): string | null {
  if (chance == null || chance >= 1) return null
  return `${Math.round(chance * 100)}% BP drop`
}

function MissionRegionBadge({ regions }: { regions: Region[] }) {
  const label =
    regions.length === 0
      ? 'Unknown'
      : regions.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')

  const isUnknown = regions.length === 0

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${
        isUnknown
          ? 'bg-slate-800/60 text-slate-500 border-slate-600/40'
          : 'bg-violet-950/50 text-violet-300 border-violet-500/40'
      }`}
    >
      {label}
    </span>
  )
}

function MissionRepBadge({
  minStandingName,
  minReputation,
}: {
  minStandingName?: string | null
  minReputation?: number | null
}) {
  if (minReputation == null && minStandingName == null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-800/60 text-slate-500 border-slate-600/40">
        Rep unknown
      </span>
    )
  }

  const isNeutral = minReputation === 0
  const label = minStandingName
    ? minReputation != null
      ? `${minStandingName} (${minReputation.toLocaleString()})`
      : minStandingName
    : minReputation != null
      ? `${minReputation.toLocaleString()} rep`
      : null

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${
        isNeutral
          ? 'bg-slate-800/60 text-slate-400 border-slate-600/40'
          : 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40'
      }`}
    >
      {label}
    </span>
  )
}

function MissionMetaLine({
  regions,
  repMin,
  repMax,
  minStandingName,
  minReputation,
  dropChance,
  isLawful = true,
  aUecMin = 0,
  aUecMax = 0,
}: {
  regions: Region[]
  repMin?: number | null
  repMax?: number | null
  minStandingName?: string | null
  minReputation?: number | null
  dropChance?: number | null
  isLawful?: boolean
  aUecMin?: number
  aUecMax?: number
}) {
  const repText = formatRepReward(repMin ?? null, repMax ?? null)
  const dropText = formatDropChance(dropChance)
  
  // Format aUEC reward
  const aUecText = aUecMin > 0 || aUecMax > 0
    ? aUecMin === aUecMax || aUecMax === 0
      ? `${aUecMin.toLocaleString()} aUEC`
      : `${aUecMin.toLocaleString()}–${aUecMax.toLocaleString()} aUEC`
    : null

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
      {/* Lawful/Illegal indicator */}
      {!isLawful && (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-red-950/50 text-red-400 border-red-500/40">
          Illegal
        </span>
      )}
      <MissionRegionBadge regions={regions} />
      <MissionRepBadge minStandingName={minStandingName} minReputation={minReputation} />
      {repText && <span className="text-[10px] text-emerald-400/90">{repText}</span>}
      {aUecText && <span className="text-[10px] text-yellow-400/90">{aUecText}</span>}
      {dropText && <span className="text-[10px] text-amber-400/80">{dropText}</span>}
    </div>
  )
}

function BlueprintUnlockBadge({
  blueprintId,
  isReward,
}: {
  blueprintId: string
  isReward?: boolean
}) {
  const info = getBlueprintUnlockInfo(blueprintId)
  const label = formatBlueprintUnlockBadge(blueprintId, isReward)
  const known = info.unlockMinReputation != null || info.isAvailableByDefault
  const showWarning = known && info.isInferred

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
        known
          ? 'text-purple-300 border-purple-500/40 bg-purple-950/30'
          : 'text-slate-500 border-slate-600/40 bg-slate-900/40'
      }`}
    >
      {label}
      {showWarning && (
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold text-amber-900 bg-amber-400 rounded cursor-help"
          title="This unlock level is estimated from community data and may not be 100% accurate"
        >
          !
        </span>
      )}
    </span>
  )
}

function MissionChecklistGroups({
  groups,
  onRemove,
}: {
  groups: ReturnType<typeof buildMissionList>
  onRemove: (mission: string) => void
}) {
  if (groups.length === 0) {
    return (
      <p className="text-slate-500 text-sm bg-slate-900/40 rounded-xl p-4 border border-slate-800">
        No missions on your checklist yet. Add missions from your targets on the left, or use{' '}
        <strong className="text-amber-300/90">Add all</strong> per blueprint.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div
          key={group.giver}
          className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden"
        >
          <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-purple-300">{group.giver}</h3>
          </div>
          <ul className="divide-y divide-slate-800">
            {group.missions.map((mission) => {
              const hasKnownRepLevel = mission.minReputation != null || mission.minStandingName != null
              return (
                <li
                  key={mission.missionKey}
                  className={`px-4 py-3 ${hasKnownRepLevel ? 'bg-amber-900/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${mission.isLawful ? 'text-green-300' : 'text-red-400'}`}>{mission.mission}</p>
                      <MissionMetaLine
                        regions={mission.regions}
                        repMin={mission.repMin}
                        repMax={mission.repMax}
                        minStandingName={mission.minStandingName}
                        minReputation={mission.minReputation}
                        dropChance={mission.dropChance}
                        isLawful={mission.isLawful}
                        aUecMin={mission.aUecMin}
                        aUecMax={mission.aUecMax}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Waiting on: {mission.unacquiredBlueprintIds.length} blueprint
                        {mission.unacquiredBlueprintIds.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRemove(mission.mission)}
                      className="shrink-0 px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg hover:bg-red-950/30 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function TargetsRoute() {
  const { acquiredBlueprints, isApproved, isGuestPreview, user } = useAuth()
  const isGuest = isGuestPreview && !user
  const { data: blueprints = [] } = useBlueprintData()
  const { overridesMap } = useBlueprintOrderOverrides()
  const [viewMode, setViewMode] = useState<ViewMode>('tracker')

  // Build a map of blueprint ID to its mission keys for cleanup
  const blueprintMissionKeysMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const bp of blueprints) {
      const keys: string[] = []
      for (const reward of bp.rewardMissions ?? []) {
        const mission = reward.mission?.trim()
        if (mission) keys.push(missionKey(mission))
      }
      map[bp.file] = keys
    }
    return map
  }, [blueprints])

  const getMissionKeysForBlueprint = useCallback(
    (blueprintId: string) => blueprintMissionKeysMap[blueprintId] ?? [],
    [blueprintMissionKeysMap]
  )

  const {
    targetIds,
    missionPrefs,
    loading,
    error,
    toggleTarget,
    addMissionToChecklist,
    removeMissionFromChecklist,
    addAllMissionsToChecklist,
    isMissionOnChecklist,
    targetCount,
    refresh,
  } = useTargetList(overridesMap, getMissionKeysForBlueprint)

  const acquiredSet = useMemo(
    () => new Set(Object.keys(acquiredBlueprints).filter((k) => acquiredBlueprints[k])),
    [acquiredBlueprints]
  )

  const targetBlueprintRecords = useMemo(() => {
    return blueprints
      .filter((bp) => targetIds[bp.file])
      .sort((a, b) => (a.blueprintName ?? '').localeCompare(b.blueprintName ?? ''))
  }, [blueprints, targetIds])

  const missionGroups = useMemo(
    () =>
      buildMissionList(
        targetBlueprintRecords.map((bp) => ({
          blueprintId: bp.file,
          blueprintName: bp.blueprintName ?? 'Unknown',
          rewardMissions: bp.rewardMissions,
        })),
        acquiredSet,
        missionPrefs
      ),
    [targetBlueprintRecords, acquiredSet, missionPrefs]
  )

  const activeMissionCount = missionGroups.reduce((sum, g) => sum + g.missions.length, 0)

  if (!isApproved && !isGuest) {
    return (
      <FeaturePageLayout
        title="Mission Tracker"
        subtitle="Track blueprints and the missions that reward them"
      >
        <div className="text-center py-16 text-slate-400">
          Available after your account is approved.
        </div>
      </FeaturePageLayout>
    )
  }

  const handleAddToTrackerFromBrowse = useCallback(
    (blueprintId: string) => {
      void toggleTarget(blueprintId)
    },
    [toggleTarget]
  )

  const isOnTargetList = useCallback(
    (blueprintId: string) => !!targetIds[blueprintId],
    [targetIds]
  )

  return (
    <FeaturePageLayout
      title="Mission Tracker"
      subtitle="Track blueprints and the missions that reward them"
      actions={
        viewMode === 'tracker' && (
          <button
            onClick={() => void refresh()}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg transition-colors"
          >
            Refresh
          </button>
        )
      }
    >
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg w-fit mb-6">
        <button
          onClick={() => setViewMode('tracker')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'tracker'
              ? 'bg-orange-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          My Tracker
        </button>
        <button
          onClick={() => setViewMode('browse')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'browse'
              ? 'bg-orange-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Browse Missions
        </button>
      </div>

      {isGuest && viewMode === 'tracker' && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-950/30 text-xs text-amber-200/90">
          <strong className="text-amber-100">Offline Mode</strong> — Your tracked missions save in this browser only. 
          Sign in to sync across devices.
        </div>
      )}

      {error && viewMode === 'tracker' && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm">
          {error}
          {error.includes('relation') && (
            <p className="mt-2 text-red-200/80">
              Run migration <code className="text-red-100">011_target_bp_list.sql</code> in Supabase first.
            </p>
          )}
        </div>
      )}

      {/* Browse Missions View */}
      {viewMode === 'browse' && (
        <BrowseMissionsView
          acquiredBlueprints={acquiredBlueprints}
          onAddToTracker={handleAddToTrackerFromBrowse}
          isOnTargetList={isOnTargetList}
        />
      )}

      {/* Tracker View */}
      {viewMode === 'tracker' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Targets</p>
              <p className="text-2xl font-bold text-white mt-1">{targetCount}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">On checklist</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{activeMissionCount}</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading tracked blueprints…</div>
          ) : targetCount === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
              <p className="text-slate-400 text-lg mb-2">No tracked blueprints yet</p>
              <p className="text-slate-500 text-sm">
                Use the <strong className="text-amber-400">Track</strong> button on a blueprint card or inside the blueprint details,
                or switch to <strong className="text-orange-400">Browse Missions</strong> to explore mission pools.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-6 items-start">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Your targets</h2>
            <div className="space-y-4">
              {targetBlueprintRecords.map((bp) => {
                const missions = getMissionsForBlueprint(
                  {
                    blueprintId: bp.file,
                    blueprintName: bp.blueprintName ?? 'Unknown',
                    rewardMissions: bp.rewardMissions,
                  },
                  acquiredSet
                )
                const addableMissions = missions.filter((m) => !isMissionOnChecklist(m.missionKey))
                const _unlockInfo = getBlueprintUnlockInfo(bp.file)

                return (
                  <div
                    key={bp.file}
                    className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden"
                  >
                    <div className="px-3 py-2.5 bg-slate-800/80 border-b border-slate-700 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white leading-snug">{bp.blueprintName}</p>
                        <div className="mt-1">
                          <BlueprintUnlockBadge
                            blueprintId={bp.file}
                            isReward={resolveIsOrderable(bp, overridesMap)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {addableMissions.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void addAllMissionsToChecklist(addableMissions.map((m) => m.mission))
                            }
                            className="px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/40 rounded hover:bg-amber-950/40 transition-colors"
                          >
                            Add all
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void toggleTarget(bp.file)}
                          className="px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 border border-red-500/30 rounded hover:bg-red-950/30 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {missions.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-500">No reward missions for this blueprint.</p>
                    ) : (
                      <ul className="divide-y divide-slate-800/80">
                        {missions.map((m) => {
                          const onChecklist = isMissionOnChecklist(m.missionKey)
                          const hasKnownRepLevel = m.minReputation != null || m.minStandingName != null
                          return (
                            <li key={m.missionKey}>
                              <button
                                type="button"
                                disabled={onChecklist}
                                onClick={() => void addMissionToChecklist(m.mission)}
                                className={`w-full text-left px-3 py-2.5 transition-colors ${
                                  onChecklist
                                    ? 'opacity-40 cursor-not-allowed bg-slate-950/20'
                                    : hasKnownRepLevel
                                      ? 'bg-amber-900/20 hover:bg-amber-800/30 cursor-pointer'
                                      : 'hover:bg-slate-800/50 cursor-pointer'
                                }`}
                                title={
                                  onChecklist
                                    ? 'Already on your checklist'
                                    : 'Add to mission checklist'
                                }
                              >
                                <p className={`text-xs leading-snug ${m.isLawful ? 'text-green-300' : 'text-red-400'}`}>{m.mission}</p>
                                <MissionMetaLine
                                  regions={m.regions}
                                  repMin={m.repMin}
                                  repMax={m.repMax}
                                  minStandingName={m.minStandingName}
                                  minReputation={m.minReputation}
                                  dropChance={m.dropChance}
                                  isLawful={m.isLawful}
                                  aUecMin={m.aUecMin}
                                  aUecMax={m.aUecMax}
                                />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Mission checklist</h2>
            <MissionChecklistGroups
              groups={missionGroups}
              onRemove={(mission) => void removeMissionFromChecklist(mission)}
            />
          </section>
        </div>
          )}
        </>
      )}
    </FeaturePageLayout>
  )
}
