import React, { useEffect, useState, useMemo } from 'react'
import { useSearch } from '@tanstack/react-router'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import { useAuth } from '../contexts/AuthContext'
import {
  useShopBrowseTree,
  useShopItemSearch,
  useShopById,
  useShopInventory,
} from '../hooks/useShopData'
import { useBlueprintLookup } from '../hooks/useBlueprintLookup'
import GuestPreviewBanner from '../components/layout/GuestPreviewBanner'
import ShopBrowseTree from '../components/shops/ShopBrowseTree'
import ShopInventoryPanel from '../components/shops/ShopInventoryPanel'

export default function ShopsRoute() {
  const { isGuestPreview, exitGuestPreview, acquiredBlueprints } = useAuth()
  const search = useSearch({ from: '/shops' })
  const { getBlueprintByItemName } = useBlueprintLookup()

  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')

  const { tree, loading: treeLoading, gameBuild } = useShopBrowseTree()
  const { matchingShopIds, loading: searchLoading } = useShopItemSearch(globalSearch)
  const { data: shopDetails, loading: shopLoading } = useShopById(selectedShopId)
  const { data: inventory, loading: inventoryLoading } = useShopInventory(selectedShopId)

  useEffect(() => {
    const shopIdParam = (search as { shop?: string }).shop
    if (shopIdParam) {
      const id = parseInt(shopIdParam, 10)
      if (!isNaN(id)) setSelectedShopId(id)
    }
  }, [search])

  const isEmpty = tree.length === 0 && !treeLoading
  const searchActive = globalSearch.trim().length >= 3
  const searchQuery = globalSearch.trim().toLowerCase()

  const filteredInventory = useMemo(() => {
    if (!searchActive) return inventory
    return inventory.filter((item) => {
      const name = (item.display_name || item.item_name || '').toLowerCase()
      return name.includes(searchQuery)
    })
  }, [inventory, searchActive, searchQuery])

  return (
    <FeaturePageLayout
      title="Shops"
      subtitle="Browse in-game item shops by system, location, and franchise"
    >
      {isGuestPreview && <GuestPreviewBanner onExit={exitGuestPreview} />}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No shop data available</h3>
          <p className="text-sm text-slate-400 max-w-md">
            Shop data has not been synced yet. A super-admin needs to run the Shop Data sync from the DB Actions panel
            after parsing game shop files.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Search items across all shops (min 3 characters)..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="site-input w-full px-4 py-2.5 text-sm"
            />
            {searchActive && (
              <p className="text-xs text-slate-500 mt-1.5">
                {searchLoading
                  ? 'Searching...'
                  : matchingShopIds
                    ? `${matchingShopIds.size} shop${matchingShopIds.size === 1 ? '' : 's'} sell matching items`
                    : 'No matching shops'}
              </p>
            )}
          </div>

          <div className="flex gap-6 min-h-[640px]">
            <div className="w-80 shrink-0">
              <ShopBrowseTree
                tree={tree}
                selectedShopId={selectedShopId}
                matchingShopIds={searchActive ? matchingShopIds : null}
                onSelectShop={setSelectedShopId}
                loading={treeLoading}
              />
            </div>

            <div className="flex-1 min-w-0">
              {shopLoading && selectedShopId ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : (
                <ShopInventoryPanel
                  shop={shopDetails}
                  inventory={filteredInventory}
                  totalInventoryCount={inventory.length}
                  loading={inventoryLoading}
                  gameBuild={gameBuild}
                  itemSearchQuery={searchActive ? globalSearch.trim() : undefined}
                  renderItemExtra={(item) => {
                    const itemName = item.display_name || ''
                    const blueprint = getBlueprintByItemName(itemName)
                    if (!blueprint) return null
                    const isAcquired = acquiredBlueprints[blueprint.internalName]
                    return (
                      <span
                        className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border ${
                          isAcquired
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border-red-500/30'
                        }`}
                      >
                        {isAcquired ? 'BP Acquired' : 'BP Not Acquired'}
                      </span>
                    )
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </FeaturePageLayout>
  )
}
