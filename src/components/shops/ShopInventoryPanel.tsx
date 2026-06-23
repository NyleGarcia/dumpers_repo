import React from 'react'
import type { ShopDetails, ShopInventoryItem } from '../../hooks/useShopData'

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || price <= 0) return 'Price TBD'
  return price.toLocaleString() + ' aUEC'
}

function TransactionBadges({ item }: { item: ShopInventoryItem }) {
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {item.shop_sells && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">
          Sells
        </span>
      )}
      {item.shop_buys && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
          Buys
        </span>
      )}
      {item.shop_rents && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
          Rents
        </span>
      )}
    </div>
  )
}

interface ShopInventoryPanelProps {
  shop: ShopDetails | null
  inventory: ShopInventoryItem[]
  totalInventoryCount?: number
  loading: boolean
  gameBuild?: string | null
  itemSearchQuery?: string
  renderItemExtra?: (item: ShopInventoryItem) => React.ReactNode
}

export default function ShopInventoryPanel({
  shop,
  inventory,
  totalInventoryCount,
  loading,
  gameBuild,
  itemSearchQuery,
  renderItemExtra,
}: ShopInventoryPanelProps) {
  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16 border border-slate-700/50 rounded-xl bg-slate-800/20">
        <p className="text-slate-400">Select a shop to view inventory</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <h2 className="text-xl font-semibold text-white">{shop.name}</h2>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-400">
          <span>{shop.system}</span>
          {shop.site && (
            <>
              <span className="text-slate-600">•</span>
              <span>{shop.site}</span>
            </>
          )}
          {shop.location && (
            <>
              <span className="text-slate-600">•</span>
              <span>{shop.location}</span>
            </>
          )}
        </div>
      </div>

      <div className="border border-slate-700/50 rounded-xl bg-slate-800/20 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading inventory...</div>
        ) : inventory.length === 0 ? (
          shop.inventory_expected === false || shop.shop_interaction === 'shelf' ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-slate-400">Shelf vendor — buy items directly in-game.</p>
              <p className="text-xs text-slate-500">
                Places like food bars and noodle counters don&apos;t use a shop terminal listing.
              </p>
            </div>
          ) : itemSearchQuery ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-slate-400">No items in this shop match &ldquo;{itemSearchQuery}&rdquo;.</p>
              {(totalInventoryCount ?? 0) > 0 && (
                <p className="text-xs text-slate-500">
                  This shop has {totalInventoryCount} items — try clearing the search to see all.
                </p>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">No inventory data for this shop yet.</div>
          )
        ) : (
          <>
            {itemSearchQuery && (totalInventoryCount ?? inventory.length) > inventory.length && (
              <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-700/30 bg-slate-800/40">
                Showing {inventory.length} of {totalInventoryCount ?? inventory.length} items matching
                &ldquo;{itemSearchQuery}&rdquo;
              </div>
            )}
            <div className="grid grid-cols-[1fr,120px,120px,90px] gap-4 px-4 py-2 bg-slate-800/50 text-xs text-slate-500 font-medium uppercase tracking-wider">
              <div>Item</div>
              <div className="text-right">Price</div>
              <div className="text-center">Type</div>
              <div className="text-center">Trade</div>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-700/30">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr,120px,120px,90px] gap-4 px-4 py-3 hover:bg-slate-700/20 items-center"
                >
                  <div>
                    <div className="text-sm text-white">{item.display_name || 'Unknown item'}</div>
                    {renderItemExtra?.(item)}
                  </div>
                  <div className="text-right text-sm text-amber-400 font-medium">
                    {formatPrice(item.effective_price ?? item.base_price)}
                  </div>
                  <div className="text-center">
                    {item.item_type && (
                      <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                        {item.item_type}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <TransactionBadges item={item} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {gameBuild && (
        <div className="text-xs text-slate-500 text-right">
          Shop data from game files (build {gameBuild})
        </div>
      )}
    </div>
  )
}
