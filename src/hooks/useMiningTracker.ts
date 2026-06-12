import { useCallback, useEffect, useState } from 'react'
import {
  type MiningTrackerEntry,
  miningTrackerEntryId,
  readMiningTrackerEntries,
  writeMiningTrackerEntries,
} from '../lib/localGuestCache'

export function useMiningTracker() {
  const [entries, setEntries] = useState<MiningTrackerEntry[]>(() => readMiningTrackerEntries())

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dumpers_mining_tracker') {
        setEntries(readMiningTrackerEntries())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const persist = useCallback((next: MiningTrackerEntry[]) => {
    writeMiningTrackerEntries(next)
    setEntries(next)
  }, [])

  const addEntry = useCallback(
    (oreName: string, rarity: string) => {
      const id = miningTrackerEntryId(oreName)
      if (entries.some((e) => e.id === id)) return false

      const next: MiningTrackerEntry[] = [
        {
          id,
          oreName,
          rarity,
          addedAt: Date.now(),
        },
        ...entries,
      ]
      persist(next)
      return true
    },
    [entries, persist]
  )

  const removeEntry = useCallback(
    (id: string) => {
      persist(entries.filter((e) => e.id !== id))
    },
    [entries, persist]
  )

  const clearAll = useCallback(() => {
    persist([])
  }, [persist])

  const isTracked = useCallback(
    (oreName: string) => {
      return entries.some((e) => e.id === miningTrackerEntryId(oreName))
    },
    [entries]
  )

  return { entries, addEntry, removeEntry, clearAll, isTracked }
}
