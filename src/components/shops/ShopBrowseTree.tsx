import React, { useMemo } from 'react'

export interface ShopTreeShop {
  id: number
  name: string
  location_type: string | null
  inventory_count: number
}

export interface ShopTreeLocation {
  location: string
  location_type: string | null
  shops: ShopTreeShop[]
}

export interface ShopTreeSite {
  site: string
  locations: ShopTreeLocation[]
}

export interface ShopTreeSystem {
  system: string
  sites: ShopTreeSite[]
}

interface ShopBrowseTreeProps {
  tree: ShopTreeSystem[]
  selectedShopId: number | null
  matchingShopIds: Set<number> | null
  onSelectShop: (shopId: number) => void
  loading?: boolean
}

function LocationTypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const colors: Record<string, string> = {
    city: 'bg-emerald-500/20 text-emerald-300',
    rest_stop: 'bg-blue-500/20 text-blue-300',
    refinery: 'bg-orange-500/20 text-orange-300',
    orbital: 'bg-purple-500/20 text-purple-300',
    unknown: 'bg-slate-500/20 text-slate-300',
  }
  const labels: Record<string, string> = {
    city: 'City',
    rest_stop: 'Rest Stop',
    refinery: 'Refinery',
    orbital: 'Orbital',
    unknown: 'Unknown',
  }
  return (
    <span className={`text-[10px] px-1 py-0.5 rounded ${colors[type] || colors.unknown}`}>
      {labels[type] || type}
    </span>
  )
}

export default function ShopBrowseTree({
  tree,
  selectedShopId,
  matchingShopIds,
  onSelectShop,
  loading,
}: ShopBrowseTreeProps) {
  const filteredTree = useMemo(() => {
    if (!matchingShopIds) return tree

    return tree
      .map((system) => ({
        ...system,
        sites: system.sites
          .map((site) => ({
            ...site,
            locations: site.locations
              .map((location) => ({
                ...location,
                shops: location.shops.filter((shop) => matchingShopIds.has(shop.id)),
              }))
              .filter((location) => location.shops.length > 0),
          }))
          .filter((site) => site.locations.length > 0),
      }))
      .filter((system) => system.sites.length > 0)
  }, [tree, matchingShopIds])

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">Loading shop tree...</div>
  }

  if (filteredTree.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        {matchingShopIds ? 'No shops match your search.' : 'No shops available.'}
      </div>
    )
  }

  return (
    <div className="border border-slate-700/50 rounded-xl bg-slate-800/20 max-h-[640px] overflow-y-auto">
      {filteredTree.map((system) => (
        <details key={system.system} open className="group/system border-b border-slate-700/30 last:border-b-0">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-white hover:bg-slate-700/20 list-none flex items-center justify-between">
            <span>{system.system}</span>
            <span className="text-xs text-slate-500">
              {system.sites.reduce(
                (acc, site) => acc + site.locations.reduce((a, l) => a + l.shops.length, 0),
                0
              )}{' '}
              shops
            </span>
          </summary>

          {system.sites.map((site) => (
            <details key={`${system.system}-${site.site}`} open className="ml-3 border-l border-slate-700/30">
              <summary className="cursor-pointer px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/20 list-none">
                {site.site}
              </summary>

              {site.locations.map((location) => (
                <details
                  key={`${system.system}-${site.site}-${location.location}`}
                  open
                  className="ml-3 border-l border-slate-700/20"
                >
                  <summary className="cursor-pointer px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/20 list-none flex items-center gap-2">
                    <span>{location.location}</span>
                    <LocationTypeBadge type={location.location_type} />
                  </summary>

                  <div className="ml-3 border-l border-slate-700/10">
                    {location.shops.map((shop) => (
                      <button
                        key={shop.id}
                        type="button"
                        onClick={() => onSelectShop(shop.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/20 transition-colors ${
                          selectedShopId === shop.id
                            ? 'bg-amber-500/10 border-l-2 border-amber-500 text-white'
                            : 'text-slate-300'
                        }`}
                      >
                        <div className="truncate">{shop.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {shop.inventory_count} items
                        </div>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </details>
          ))}
        </details>
      ))}
    </div>
  )
}
