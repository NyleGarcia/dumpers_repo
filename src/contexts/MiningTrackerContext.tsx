import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import {
  type DepositType,
  type MiningTrackerAddOptions,
  type MiningTrackerEntry,
  ensureGuestCacheSchema,
  miningTrackerEntryId,
  readMiningTrackerEntries,
  writeMiningTrackerEntries,
} from '../lib/localGuestCache'

interface DbEntry {
  id: string
  ore_name: string
  rarity: string
  deposit_type: string
  profile_mode: string
  location_name: string | null
  added_at: string
}

function dbToLocal(db: DbEntry): MiningTrackerEntry {
  const depositType: DepositType = db.deposit_type === 'asteroid' ? 'asteroid' : 'surface'
  return {
    id: miningTrackerEntryId(db.ore_name, depositType),
    oreName: db.ore_name,
    depositType,
    rarity: db.rarity,
    addedAt: new Date(db.added_at).getTime(),
    profileMode: db.profile_mode === 'location' ? 'location' : 'overall',
    locationName: db.location_name ?? undefined,
  }
}

interface MiningTrackerContextValue {
  entries: MiningTrackerEntry[]
  addEntry: (oreName: string, rarity: string, options: MiningTrackerAddOptions) => Promise<boolean>
  removeEntry: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  isTracked: (oreName: string, depositType: DepositType) => boolean
  loading: boolean
}

const MiningTrackerContext = createContext<MiningTrackerContextValue | null>(null)

export function MiningTrackerProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuestPreview } = useAuth()
  const isGuest = !user || isGuestPreview

  const [entries, setEntries] = useState<MiningTrackerEntry[]>(() =>
    isGuest ? readMiningTrackerEntries() : []
  )
  const [loading, setLoading] = useState(!isGuest)

  useEffect(() => {
    if (isGuest) {
      ensureGuestCacheSchema()
      setEntries(readMiningTrackerEntries())
      setLoading(false)
      return
    }

    const loadFromDb = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.rpc('get_mining_tracker_entries')
        if (error) throw error
        setEntries((data || []).map(dbToLocal))
      } catch (err) {
        console.error('Failed to load mining tracker:', err)
      }
      setLoading(false)
    }

    loadFromDb()
  }, [isGuest, user?.id])

  useEffect(() => {
    if (!isGuest) return

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dumpers_mining_tracker') {
        setEntries(readMiningTrackerEntries())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [isGuest])

  const addEntry = useCallback(
    async (oreName: string, rarity: string, options: MiningTrackerAddOptions) => {
      const depositType = options.depositType
      const profileMode = options.profileMode ?? 'overall'
      const locationName = profileMode === 'location' ? options.locationName : undefined
      const id = miningTrackerEntryId(oreName, depositType)
      const nextEntry: MiningTrackerEntry = {
        id,
        oreName,
        depositType,
        rarity,
        addedAt: Date.now(),
        profileMode,
        locationName,
      }

      if (isGuest) {
        const without = entries.filter((e) => e.id !== id)
        const next = [nextEntry, ...without]
        writeMiningTrackerEntries(next)
        setEntries(next)
        return true
      }

      try {
        const { error } = await supabase.rpc('add_mining_tracker_entry', {
          p_ore_name: oreName,
          p_rarity: rarity,
          p_deposit_type: depositType,
          p_profile_mode: profileMode,
          p_location_name: locationName ?? null,
        })
        if (error) throw error
        setEntries((prev) => {
          const without = prev.filter((e) => e.id !== id)
          return [nextEntry, ...without]
        })
        return true
      } catch (err) {
        console.error('Failed to add mining tracker entry:', err)
        return false
      }
    },
    [entries, isGuest]
  )

  const removeEntry = useCallback(
    async (id: string) => {
      if (isGuest) {
        const next = entries.filter((e) => e.id !== id)
        writeMiningTrackerEntries(next)
        setEntries(next)
        return
      }

      try {
        const { error } = await supabase.rpc('remove_mining_tracker_entry', {
          p_entry_id: id,
        })
        if (error) throw error
        setEntries((prev) => prev.filter((e) => e.id !== id))
      } catch (err) {
        console.error('Failed to remove mining tracker entry:', err)
      }
    },
    [entries, isGuest]
  )

  const clearAll = useCallback(async () => {
    if (isGuest) {
      writeMiningTrackerEntries([])
      setEntries([])
      return
    }

    try {
      const { error } = await supabase.rpc('clear_mining_tracker')
      if (error) throw error
      setEntries([])
    } catch (err) {
      console.error('Failed to clear mining tracker:', err)
    }
  }, [isGuest])

  const isTracked = useCallback(
    (oreName: string, depositType: DepositType) => {
      return entries.some((e) => e.id === miningTrackerEntryId(oreName, depositType))
    },
    [entries]
  )

  return (
    <MiningTrackerContext.Provider
      value={{ entries, addEntry, removeEntry, clearAll, isTracked, loading }}
    >
      {children}
    </MiningTrackerContext.Provider>
  )
}

export function useMiningTracker() {
  const context = useContext(MiningTrackerContext)
  if (!context) {
    throw new Error('useMiningTracker must be used within MiningTrackerProvider')
  }
  return context
}
