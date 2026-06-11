import { useCallback, useEffect, useState } from 'react'
import { useLatestRef } from './useLatestRef'
import { useAuth } from '../contexts/AuthContext'
import { missionKey } from '../lib/missions'
import { canAddBlueprintToTargetListById } from '../lib/blueprintOrderable'
import {
  addTargetBlueprint,
  fetchMissionPrefs,
  fetchTargetBlueprintIds,
  removeTargetBlueprint,
  removeMissionPrefsByKeys,
  setMissionIncluded,
} from '../lib/targetList'
import {
  readGuestTargetList,
  writeGuestTargetIds,
  writeGuestMissionPrefs,
} from '../lib/localGuestCache'

export type GetMissionKeysForBlueprint = (blueprintId: string) => string[]

export function useTargetList(
  overridesMap: Record<string, boolean> = {},
  getMissionKeysForBlueprint?: GetMissionKeysForBlueprint
) {
  const { user, isApproved, acquiredBlueprints, isGuestPreview } = useAuth()
  const [targetIds, setTargetIds] = useState<Record<string, boolean>>({})
  const [missionPrefs, setMissionPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const acquiredRef = useLatestRef(acquiredBlueprints)
  const getMissionKeysRef = useLatestRef(getMissionKeysForBlueprint)

  // Guest mode: use localStorage
  const isGuest = isGuestPreview && !user

  const refresh = useCallback(async () => {
    // Guest mode: load from localStorage
    if (isGuest) {
      const { targetIds: guestTargets, missionPrefs: guestPrefs } = readGuestTargetList()
      setTargetIds(guestTargets)
      setMissionPrefs(guestPrefs)
      setLoading(false)
      return
    }

    if (!user?.id || !isApproved) {
      setTargetIds({})
      setMissionPrefs({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const acquired = acquiredRef.current

    try {
      const [ids, prefs] = await Promise.all([
        fetchTargetBlueprintIds(user.id),
        fetchMissionPrefs(user.id),
      ])

      const staleAcquired = ids.filter((id) => acquired[id])
      if (staleAcquired.length > 0) {
        await Promise.all(
          staleAcquired.map((id) => removeTargetBlueprint(user.id, id))
        )
      }

      const map: Record<string, boolean> = {}
      ids
        .filter((id) => !acquired[id])
        .forEach((id) => {
          map[id] = true
        })
      setTargetIds(map)
      setMissionPrefs(prefs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load target list')
    } finally {
      setLoading(false)
    }
    // acquiredRef is intentionally omitted — stable ref to latest map without re-fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isApproved, isGuest])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    // Skip acquired cleanup for guests (no acquired tracking)
    if (isGuest) return
    if (!user?.id || !isApproved) return

    const acquiredOnTarget = Object.keys(targetIds).filter((id) => acquiredBlueprints[id])
    if (acquiredOnTarget.length === 0) return

    void (async () => {
      // Collect all mission keys to remove for acquired blueprints
      const getMissionKeys = getMissionKeysRef.current
      const missionKeysToRemove: string[] = []
      if (getMissionKeys) {
        for (const bpId of acquiredOnTarget) {
          missionKeysToRemove.push(...getMissionKeys(bpId))
        }
      }

      await Promise.all([
        ...acquiredOnTarget.map((id) => removeTargetBlueprint(user.id, id)),
        missionKeysToRemove.length > 0
          ? removeMissionPrefsByKeys(user.id, missionKeysToRemove)
          : Promise.resolve(),
      ])

      setTargetIds((prev) => {
        const next = { ...prev }
        for (const id of acquiredOnTarget) delete next[id]
        return next
      })

      // Also update local mission prefs state
      if (missionKeysToRemove.length > 0) {
        setMissionPrefs((prev) => {
          const next = { ...prev }
          for (const key of missionKeysToRemove) delete next[key]
          return next
        })
      }
    })()
    // getMissionKeysRef is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquiredBlueprints, targetIds, user?.id, isApproved, isGuest])

  const toggleTarget = useCallback(
    async (blueprintId: string) => {
      // Guest mode: localStorage only
      if (isGuest) {
        const isOnList = !!targetIds[blueprintId]

        if (isOnList) {
          const getMissionKeys = getMissionKeysRef.current
          const missionKeysToRemove = getMissionKeys ? getMissionKeys(blueprintId) : []

          const nextTargets = { ...targetIds }
          delete nextTargets[blueprintId]
          setTargetIds(nextTargets)
          writeGuestTargetIds(nextTargets)

          if (missionKeysToRemove.length > 0) {
            const nextPrefs = { ...missionPrefs }
            for (const key of missionKeysToRemove) delete nextPrefs[key]
            setMissionPrefs(nextPrefs)
            writeGuestMissionPrefs(nextPrefs)
          }
        } else {
          if (!canAddBlueprintToTargetListById(blueprintId, overridesMap)) {
            setError(
              'This blueprint cannot be added to your target list (not orderable and no reward missions).'
            )
            return false
          }
          const nextTargets = { ...targetIds, [blueprintId]: true }
          setTargetIds(nextTargets)
          writeGuestTargetIds(nextTargets)
        }
        return true
      }

      if (!user || !isApproved) return false

      if (acquiredBlueprints[blueprintId]) {
        setError('This blueprint is already in your pool and cannot be on the target list.')
        return false
      }

      const isOnList = !!targetIds[blueprintId]

      if (isOnList) {
        // Get mission keys to remove along with the blueprint
        const getMissionKeys = getMissionKeysRef.current
        const missionKeysToRemove = getMissionKeys ? getMissionKeys(blueprintId) : []

        const result = await removeTargetBlueprint(user.id, blueprintId, missionKeysToRemove)
        if (result.error) {
          setError(result.error)
          return false
        }
        setTargetIds((prev) => {
          const next = { ...prev }
          delete next[blueprintId]
          return next
        })

        // Also update local mission prefs state
        if (missionKeysToRemove.length > 0) {
          setMissionPrefs((prev) => {
            const next = { ...prev }
            for (const key of missionKeysToRemove) delete next[key]
            return next
          })
        }
      } else {
        if (!canAddBlueprintToTargetListById(blueprintId, overridesMap)) {
          setError(
            'This blueprint cannot be added to your target list (not orderable and no reward missions).'
          )
          return false
        }

        const result = await addTargetBlueprint(user.id, blueprintId)
        if (result.error) {
          setError(result.error)
          return false
        }
        setTargetIds((prev) => ({ ...prev, [blueprintId]: true }))
      }

      return true
    },
    // getMissionKeysRef is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isApproved, targetIds, missionPrefs, acquiredBlueprints, overridesMap, isGuest]
  )

  const setMissionOnChecklist = useCallback(
    async (missionLabel: string, onChecklist: boolean) => {
      // Guest mode: localStorage only
      if (isGuest) {
        const key = missionKey(missionLabel)
        const nextPrefs = { ...missionPrefs, [key]: onChecklist }
        setMissionPrefs(nextPrefs)
        writeGuestMissionPrefs(nextPrefs)
        return true
      }

      if (!user || !isApproved) return false

      const result = await setMissionIncluded(user.id, missionLabel, onChecklist)
      if (result.error) {
        setError(result.error)
        return false
      }

      setMissionPrefs((prev) => ({
        ...prev,
        [missionKey(missionLabel)]: onChecklist,
      }))

      return true
    },
    [user, isApproved, isGuest, missionPrefs]
  )

  const addMissionToChecklist = useCallback(
    async (missionLabel: string) => setMissionOnChecklist(missionLabel, true),
    [setMissionOnChecklist]
  )

  const removeMissionFromChecklist = useCallback(
    async (missionLabel: string) => setMissionOnChecklist(missionLabel, false),
    [setMissionOnChecklist]
  )

  const addAllMissionsToChecklist = useCallback(
    async (missionLabels: string[]) => {
      const toAdd = missionLabels.filter((label) => missionPrefs[missionKey(label)] !== true)
      if (toAdd.length === 0) return true

      // Guest mode: localStorage only
      if (isGuest) {
        const nextPrefs = { ...missionPrefs }
        for (const label of toAdd) {
          nextPrefs[missionKey(label)] = true
        }
        setMissionPrefs(nextPrefs)
        writeGuestMissionPrefs(nextPrefs)
        return true
      }

      if (!user || !isApproved) return false

      const results = await Promise.all(
        toAdd.map((label) => setMissionIncluded(user.id, label, true))
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        setError(failed.error)
        return false
      }

      setMissionPrefs((prev) => {
        const next = { ...prev }
        for (const label of toAdd) {
          next[missionKey(label)] = true
        }
        return next
      })

      return true
    },
    [user, isApproved, missionPrefs, isGuest]
  )

  const isMissionOnChecklist = useCallback(
    (key: string) => missionPrefs[key] === true,
    [missionPrefs]
  )

  return {
    targetIds,
    missionPrefs,
    loading,
    error,
    refresh,
    toggleTarget,
    addMissionToChecklist,
    removeMissionFromChecklist,
    addAllMissionsToChecklist,
    isMissionOnChecklist,
    isOnTargetList: (blueprintId: string) => !!targetIds[blueprintId],
    targetCount: Object.keys(targetIds).length,
  }
}
