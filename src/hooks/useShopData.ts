import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { ShopTreeSystem } from '../components/shops/ShopBrowseTree'
import { resolveTreeSite, shouldFlattenLocation } from '../lib/shopHierarchy'

export interface ShopSystem {
  system: string
  shop_count: number
}

export interface ShopSite {
  site: string
  shop_count: number
}

export interface ShopLocation {
  location: string
  location_type: string | null
  shop_count: number
}

export interface Shop {
  id: number
  shop_reference: string
  name: string
  location_type: string | null
  accepts_stolen_goods: boolean
  profit_margin: number
}

export interface ShopDetails extends Shop {
  container_path: string | null
  system: string
  site: string | null
  location: string | null
  shop_category?: string | null
  franchise?: string | null
  game_build?: string | null
  shop_interaction?: string | null
  inventory_expected?: boolean | null
}

export interface ShopInventoryItem {
  id: number
  item_name: string
  display_name: string | null
  item_type: string | null
  sub_type: string | null
  base_price: number | null
  effective_price: number | null
  shop_buys: boolean
  shop_sells: boolean
  shop_rents: boolean
  tags: string[] | null
}

export interface ShopInventoryType {
  item_type: string
  item_count: number
}

export interface ComponentShopListing {
  shop_id: number
  shop_name: string
  location: string | null
  system: string
  effective_price: number | null
  base_price: number | null
}

export interface ComponentPriceSummary {
  component_name: string
  component_type: string | null
  avg_price: number | null
  min_price: number | null
  max_price: number | null
  shop_count: number
}

export interface ShopSearchResult {
  shop_id: number
  shop_name: string
  system: string
  site: string | null
  location: string | null
  location_type: string | null
  matching_items: number
}

let priceSummaryCache: Map<string, ComponentPriceSummary> | null = null

function buildBrowseTree(
  rows: Array<{
    id: number
    name: string
    system: string
    site: string
    location: string | null
    location_type: string | null
    inventory_count: number
  }>
): ShopTreeSystem[] {
  const systems = new Map<string, Map<string, Map<string, ShopTreeSystem['sites'][0]['locations'][0]>>>()

  for (const row of rows) {
    if (!row.location) continue

    if (!systems.has(row.system)) systems.set(row.system, new Map())
    const siteMap = systems.get(row.system)!
    const siteKey = resolveTreeSite(row.system, row.site, row.location, row.location_type)
    if (!siteMap.has(siteKey)) siteMap.set(siteKey, new Map())

    const locMap = siteMap.get(siteKey)!
    const locationKey = shouldFlattenLocation(siteKey, row.location)
      ? siteKey
      : row.location

    if (!locMap.has(locationKey)) {
      locMap.set(locationKey, {
        location: locationKey,
        location_type: row.location_type,
        shops: [],
      })
    }
    locMap.get(locationKey)!.shops.push({
      id: row.id,
      name: row.name,
      location_type: row.location_type,
      inventory_count: Number(row.inventory_count) || 0,
    })
  }

  return [...systems.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([system, siteMap]) => ({
      system,
      sites: [...siteMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([site, locMap]) => ({
          site,
          locations: [...locMap.values()].sort((a, b) => a.location.localeCompare(b.location)),
        })),
    }))
}

export function useShopBrowseTree() {
  const [tree, setTree] = useState<ShopTreeSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameBuild, setGameBuild] = useState<string | null>(null)

  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true)
      setError(null)

      const [treeResult, statusResult] = await Promise.all([
        supabase.rpc('get_shop_browse_tree'),
        supabase.rpc('get_shop_data_sync_status'),
      ])

      if (treeResult.error) {
        setError(treeResult.error.message)
        setTree([])
      } else {
        setTree(buildBrowseTree(treeResult.data || []))
      }

      if (statusResult.data?.[0]?.source_version) {
        setGameBuild(statusResult.data[0].source_version)
      }

      setLoading(false)
    }

    void fetchTree()
  }, [])

  return { tree, loading, error, gameBuild }
}

export function useShopItemSearch(query: string) {
  const [matchingShopIds, setMatchingShopIds] = useState<Set<number> | null>(null)
  const [results, setResults] = useState<ShopSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setMatchingShopIds(null)
      setResults([])
      setLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase.rpc('search_shops_by_item', {
        p_query: trimmed,
      })

      if (queryError) {
        setError(queryError.message)
        setMatchingShopIds(new Set())
        setResults([])
      } else {
        const rows = (data || []) as ShopSearchResult[]
        setResults(rows)
        setMatchingShopIds(new Set(rows.map((r) => r.shop_id)))
      }

      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return { matchingShopIds, results, loading, error }
}

export function useShopSystems() {
  const [data, setData] = useState<ShopSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSystems = async () => {
      setLoading(true)
      setError(null)

      const { data: result, error: queryError } = await supabase.rpc('get_shop_systems')

      if (queryError) {
        setError(queryError.message)
        setData([])
      } else {
        setData(result || [])
      }

      setLoading(false)
    }

    fetchSystems()
  }, [])

  return { data, loading, error }
}

export function useShopById(shopId: number | null) {
  const [data, setData] = useState<ShopDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shopId) {
      setData(null)
      return
    }

    const fetchShop = async () => {
      setLoading(true)
      setError(null)

      const { data: result, error: queryError } = await supabase.rpc('get_shop_by_id', {
        p_shop_id: shopId,
      })

      if (queryError) {
        setError(queryError.message)
        setData(null)
      } else {
        setData(result?.[0] || null)
      }

      setLoading(false)
    }

    fetchShop()
  }, [shopId])

  return { data, loading, error }
}

export function useShopInventory(shopId: number | null) {
  const [data, setData] = useState<ShopInventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shopId) {
      setData([])
      return
    }

    const fetchInventory = async () => {
      setLoading(true)
      setError(null)

      const { data: result, error: queryError } = await supabase.rpc('get_shop_inventory', {
        p_shop_id: shopId,
        p_item_type: null,
        p_search: null,
        p_sells_only: null,
      })

      if (queryError) {
        setError(queryError.message)
        setData([])
      } else {
        setData(result || [])
      }

      setLoading(false)
    }

    fetchInventory()
  }, [shopId])

  return { data, loading, error }
}

export function useShopsSellingComponent(componentName: string | null) {
  const [data, setData] = useState<ComponentShopListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!componentName) {
      setData([])
      return
    }

    const fetchShops = async () => {
      setLoading(true)
      setError(null)

      const { data: result, error: queryError } = await supabase.rpc('get_shops_selling_component', {
        p_component_name: componentName,
      })

      if (queryError) {
        setError(queryError.message)
        setData([])
      } else {
        setData(result || [])
      }

      setLoading(false)
    }

    fetchShops()
  }, [componentName])

  return { data, loading, error }
}

export function useComponentPriceSummaries() {
  const [data, setData] = useState<Map<string, ComponentPriceSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: result, error: queryError } = await supabase.rpc('get_component_price_summaries')

    if (queryError) {
      setError(queryError.message)
      setData(new Map())
    } else {
      const map = new Map<string, ComponentPriceSummary>()
      for (const item of result || []) {
        map.set(item.component_name, item)
      }
      priceSummaryCache = map
      setData(map)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (priceSummaryCache) {
      setData(priceSummaryCache)
      setLoading(false)
      return
    }

    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

export function getComponentPriceFromCache(componentName: string): ComponentPriceSummary | undefined {
  return priceSummaryCache?.get(componentName)
}

export function useShopInventoryTypes() {
  const [data, setData] = useState<ShopInventoryType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTypes = async () => {
      const { data: result } = await supabase.rpc('get_shop_inventory_types')
      setData(result || [])
      setLoading(false)
    }
    fetchTypes()
  }, [])

  return { data, loading }
}

// Legacy hooks kept for any remaining imports
export function useShopLocations(system: string | null) {
  const [data, setData] = useState<ShopLocation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!system) {
      setData([])
      return
    }
    const fetchLocations = async () => {
      setLoading(true)
      const { data: result } = await supabase.rpc('get_shop_locations', { p_system: system })
      setData(result || [])
      setLoading(false)
    }
    fetchLocations()
  }, [system])

  return { data, loading, error: null }
}

export function useShopsAtLocation(system: string | null, location: string | null) {
  const [data, setData] = useState<Shop[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!system) {
      setData([])
      return
    }
    const fetchShops = async () => {
      setLoading(true)
      const { data: result } = await supabase.rpc('get_shops_at_location', {
        p_system: system,
        p_location: location,
      })
      setData(result || [])
      setLoading(false)
    }
    fetchShops()
  }, [system, location])

  return { data, loading, error: null }
}
