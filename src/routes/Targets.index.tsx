import React, { useMemo } from 'react'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import { useBlueprintData } from './blueprints'
import { useAuth } from '../contexts/AuthContext'
import { useTargetList } from '../hooks/useTargetList'
import { buildMissionList } from '../lib/missions'

export default function TargetsRoute() {
  const { acquiredBlueprints, isApproved } = useAuth()
  const { data: blueprints = [] } = useBlueprintData()
  const {
    targetIds,
    missionPrefs,
    loading,
    error,
    toggleTarget,
    toggleMissionPref,
    targetCount,
    refresh,
  } = useTargetList()

  const acquiredSet = useMemo(
    () => new Set(Object.keys(acquiredBlueprints).filter((k) => acquiredBlueprints[k])),
    [acquiredBlueprints]
  )

  const targetBlueprintRecords = useMemo(() => {
    return blueprints.filter((bp) => targetIds[bp.file])
  }, [blueprints, targetIds])

  const acquiredTargetCount = useMemo(
    () => targetBlueprintRecords.filter((bp) => acquiredSet.has(bp.file)).length,
    [targetBlueprintRecords, acquiredSet]
  )

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

  if (!isApproved) {
    return (
      <FeaturePageLayout
        title="Target BP List"
        subtitle="Track blueprints you want and the missions that reward them"
      >
        <div className="text-center py-16 text-slate-400">
          Available after your account is approved.
        </div>
      </FeaturePageLayout>
    )
  }

  return (
    <FeaturePageLayout
      title="Target BP List"
      subtitle="Missions stay on your list while any linked target blueprint is not yet acquired"
      actions={
        <button
          onClick={() => void refresh()}
          className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg transition-colors"
        >
          Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm">
          {error}
          {error.includes('relation') && (
            <p className="mt-2 text-red-200/80">
              Run migration <code className="text-red-100">011_target_bp_list.sql</code> in Supabase first.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Target blueprints</p>
          <p className="text-2xl font-bold text-white mt-1">{targetCount}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Acquired</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {acquiredTargetCount}
            <span className="text-slate-500 text-base font-normal"> / {targetCount}</span>
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Active missions</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{activeMissionCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading target list…</div>
      ) : targetCount === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
          <p className="text-slate-400 text-lg mb-2">No target blueprints yet</p>
          <p className="text-slate-500 text-sm">
            Open a blueprint on the catalog and use <strong className="text-amber-400">Add to Target List</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Mission checklist</h2>
            {activeMissionCount === 0 ? (
              <p className="text-slate-500 text-sm bg-slate-900/40 rounded-xl p-4 border border-slate-800">
                No active missions — either all linked targets are acquired, or missions are toggled off.
              </p>
            ) : (
              <div className="space-y-4">
                {missionGroups.map((group) => (
                  <div
                    key={group.giver}
                    className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
                      <h3 className="text-sm font-semibold text-purple-300">{group.giver}</h3>
                    </div>
                    <ul className="divide-y divide-slate-800">
                      {group.missions.map((mission) => {
                        const included = missionPrefs[mission.missionKey] !== false
                        return (
                          <li key={mission.missionKey} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={(e) =>
                                  void toggleMissionPref(mission.mission, e.target.checked)
                                }
                                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/40"
                                title={included ? 'Hide this mission' : 'Show this mission'}
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${included ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                                  {mission.mission}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Waiting on: {mission.unacquiredBlueprintIds.length} blueprint
                                  {mission.unacquiredBlueprintIds.length === 1 ? '' : 's'}
                                </p>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Your targets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {targetBlueprintRecords.map((bp) => {
                const acquired = acquiredSet.has(bp.file)
                return (
                  <div
                    key={bp.file}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${
                      acquired
                        ? 'bg-green-950/20 border-green-500/30'
                        : 'bg-slate-900/50 border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${acquired ? 'text-green-300' : 'text-white'}`}>
                        {bp.blueprintName}
                      </p>
                      {acquired && (
                        <p className="text-xs text-green-500/80 mt-0.5">Acquired</p>
                      )}
                    </div>
                    <button
                      onClick={() => void toggleTarget(bp.file)}
                      className="shrink-0 px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg hover:bg-red-950/30 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </FeaturePageLayout>
  )
}
