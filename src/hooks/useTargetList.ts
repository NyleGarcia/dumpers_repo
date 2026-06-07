import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { missionKey } from '../lib/missions'
import {
  addTargetBlueprint,
  fetchMissionPrefs,
  fetchTargetBlueprintIds,
  removeTargetBlueprint,
  setMissionIncluded,
} from '../lib/targetList'

export function useTargetList() {
  const { user, profile, isApproved } = useAuth()
  const [targetIds, setTargetIds] = useState<Record<string, boolean>>({})
  const [missionPrefs, setMissionPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || !isApproved) {
      setTargetIds({})
      setMissionPrefs({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [ids, prefs] = await Promise.all([
        fetchTargetBlueprintIds(user.id),
        fetchMissionPrefs(user.id),
      ])

      const map: Record<string, boolean> = {}
      ids.forEach((id) => {
        map[id] = true
      })
      setTargetIds(map)
      setMissionPrefs(prefs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load target list')
    } finally {
      setLoading(false)
    }
  }, [user, isApproved])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggleTarget = useCallback(
    async (blueprintId: string) => {
      if (!user || !isApproved) return false

      const isOnList = !!targetIds[blueprintId]

      if (isOnList) {
        const result = await removeTargetBlueprint(user.id, blueprintId)
        if (result.error) {
          setError(result.error)
          return false
        }
        setTargetIds((prev) => {
          const next = { ...prev }
          delete next[blueprintId]
          return next
        })
      } else {
        const result = await addTargetBlueprint(user.id, blueprintId, profile?.org_id)
        if (result.error) {
          setError(result.error)
          return false
        }
        setTargetIds((prev) => ({ ...prev, [blueprintId]: true }))
      }

      return true
    },
    [user, isApproved, targetIds, profile?.org_id]
  )

  const toggleMissionPref = useCallback(
    async (missionLabel: string, included: boolean) => {
      if (!user || !isApproved) return false

      const result = await setMissionIncluded(user.id, missionLabel, included)
      if (result.error) {
        setError(result.error)
        return false
      }

      setMissionPrefs((prev) => ({
        ...prev,
        [missionKey(missionLabel)]: included,
      }))

      return true
    },
    [user, isApproved]
  )

  return {
    targetIds,
    missionPrefs,
    loading,
    error,
    refresh,
    toggleTarget,
    toggleMissionPref,
    isOnTargetList: (blueprintId: string) => !!targetIds[blueprintId],
    targetCount: Object.keys(targetIds).length,
  }
}
