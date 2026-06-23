import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { bundledComponentCatalog } from '../lib/componentCatalog'

export interface MiningData {
  id: number
  ore_name: string
  rarity: string
  locations: string[]
}

export interface ComponentData {
  id: number
  internal_id: string
  display_name: string
  component_type: string
  type_code: string
  manufacturer: string
  manufacturer_code: string
  size: number
  class: string
  class_code: string
  grade: string
  grade_rank: number
  full_label: string
}

export interface OrdnanceData {
  id: number
  internal_id: string
  display_name: string
  guidance: string
  guidance_code: string
  size: number
  is_gimbal: boolean
  is_torpedo: boolean
  ordnance_type: string
  manufacturer: string | null
  full_label: string
}

export interface BlueprintPoolData {
  id: number
  contract_key: string
  blueprints: string[]
  standing_tier: string
}

export interface BlueprintStandingData {
  id: number
  blueprint_name: string
  min_standing: string
  contract_keys: string[]
}

interface UseArchiveDataResult<T> {
  data: T[] | null
  loading: boolean
  error: string | null
  refetch: () => void
}

const dataCache: Record<string, { data: unknown[]; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

function useCachedArchiveData<T>(
  tableName: string,
  orderBy?: string
): UseArchiveDataResult<T> {
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (forceRefresh = false) => {
    const cacheKey = `${tableName}:${orderBy || 'default'}`
    const cached = dataCache[cacheKey]
    const now = Date.now()

    if (!forceRefresh && cached && now - cached.timestamp < CACHE_DURATION) {
      setData(cached.data as T[])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let query = supabase.from(tableName).select('*')
      if (orderBy) {
        query = query.order(orderBy)
      }
      const { data: result, error: queryError } = await query

      if (queryError) throw queryError

      dataCache[cacheKey] = { data: result || [], timestamp: now }
      setData(result as T[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tableName, orderBy])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
  }
}

export function useMiningData() {
  return useCachedArchiveData<MiningData>('game_mining', 'rarity')
}

export function useComponentsData(): UseArchiveDataResult<ComponentData> {
  return {
    data: bundledComponentCatalog,
    loading: false,
    error: null,
    refetch: () => {},
  }
}

export function useOrdnanceData() {
  return useCachedArchiveData<OrdnanceData>('game_ordnance', 'size')
}

export function useBlueprintPoolsData() {
  return useCachedArchiveData<BlueprintPoolData>('game_blueprint_pools', 'standing_tier')
}

export function useBlueprintStandingsData() {
  return useCachedArchiveData<BlueprintStandingData>('game_blueprint_standings', 'min_standing')
}
