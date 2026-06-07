import React, { useEffect, useMemo, useState } from 'react'
import ResourceBuyOrderPanel from '../components/ResourceBuyOrderPanel'
import { useBlueprintData } from './blueprints'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import { useAuth } from '../contexts/AuthContext'
import { useResourceCatalog } from '../hooks/useResourceCatalog'
import { canManageOrgInventory, canUseFeature } from '../lib/featureAccess'
import { adjustInventoryQuantity, setInventoryQuantity } from '../lib/operations'
import type { InventoryScope } from '../lib/operations'
import {
  formatResourceQuantity,
  parseResourceQuantity,
  RESOURCE_QUANTITY_STEP,
  roundResourceQuantity,
} from '../lib/resourceQuantity'

type TrackerTab = InventoryScope | 'place-order'

const ADJUST_STEPS = [0.001, 0.01, 0.1, 1] as const

export default function ResourceTrackerRoute() {
  const { user, siteOrg, visibilityContext, isSuperAdmin, isGhostMode } = useAuth()
  const canViewShared =
    !isGhostMode && canUseFeature('org_resources', visibilityContext)
  const canEditShared = canManageOrgInventory(visibilityContext)

  const [activeTab, setActiveTab] = useState<TrackerTab>('personal')
  const [orderError, setOrderError] = useState<string | null>(null)
  const { data: blueprints = [] } = useBlueprintData()

  useEffect(() => {
    if (isGhostMode && activeTab === 'org') setActiveTab('personal')
  }, [isGhostMode, activeTab])

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const inventoryScope: InventoryScope =
    activeTab === 'org' ? 'org' : 'personal'

  const inventoryContext = useMemo(() => {
    if (!user?.id) return null
    return {
      scope: inventoryScope,
      userId: user.id,
      orgId: siteOrg?.id ?? null,
    }
  }, [user?.id, siteOrg?.id, inventoryScope])

  const readOnly = activeTab === 'org' && !canEditShared

  const {
    catalog,
    catalogWithInventory,
    labelMap,
    syncResult,
    loading,
    error,
    refresh,
    syncFromBlueprints,
  } = useResourceCatalog({
    enableCatalogSync: isSuperAdmin,
    includeInactive: showInactive,
    withInventory: activeTab !== 'place-order',
    inventoryContext: activeTab === 'place-order' ? null : inventoryContext,
  })

  const displayCatalog = catalogWithInventory

  const filteredResources = displayCatalog.filter((resource) => {
    const matchesSearch =
      search === '' ||
      resource.label.toLowerCase().includes(search.toLowerCase()) ||
      resource.resource_key.toLowerCase().includes(search.toLowerCase())
    const matchesActive = showInactive || resource.is_active
    return matchesSearch && matchesActive
  })

  const activeCount = displayCatalog.filter((r) => r.is_active).length
  const inStockCount = displayCatalog.filter((r) => r.is_active && r.quantity > 0).length
  const totalQty = roundResourceQuantity(
    displayCatalog.filter((r) => r.is_active).reduce((sum, r) => sum + r.quantity, 0)
  )

  const handleAdjust = async (resourceKey: string, delta: number) => {
    if (!inventoryContext || readOnly) return
    const result = await adjustInventoryQuantity(inventoryContext, resourceKey, delta)
    if (result.error) return
    await refresh()
  }

  const handleSaveEdit = async (resourceKey: string) => {
    if (!inventoryContext || readOnly) return
    const qty = parseResourceQuantity(editValue)
    if (qty == null) return

    const result = await setInventoryQuantity(inventoryContext, resourceKey, qty)
    if (result.error) return

    setEditingKey(null)
    setEditValue('')
    await refresh()
  }

  const tabLabel =
    activeTab === 'personal'
      ? 'My Resources'
      : activeTab === 'org'
        ? 'Shared Stock'
        : 'Place order'

  const isInventoryTab = activeTab === 'personal' || activeTab === 'org'

  return (
    <FeaturePageLayout
      title="Resource Tracker"
      subtitle={
        activeTab === 'personal'
          ? 'Personal crafting materials (SCU, up to 3 decimals)'
          : activeTab === 'org'
            ? `${siteOrg?.name ?? 'Shared'} stock`
            : 'Submit buy orders for blueprints and/or refined materials (→ Custom Orders)'
      }
      actions={
        isSuperAdmin && isInventoryTab ? (
          <button
            onClick={() => void syncFromBlueprints()}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg transition-colors"
          >
            Sync from blueprints
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2 mb-6 p-1 bg-slate-900/60 border border-slate-700 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'personal'
              ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          My Resources
        </button>
        {canViewShared && (
          <button
            type="button"
            onClick={() => setActiveTab('org')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'org'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Shared Stock
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('place-order')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'place-order'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Place order
        </button>
      </div>

      {readOnly && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-400 text-sm">
          Shared stock is read-only for members. Officers can update quantities.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm">
          {error}
          {error.includes('relation') && (
            <p className="mt-2 text-red-200/80">
              Run pending Supabase migrations (013+, 026 for resource order lines) first.
            </p>
          )}
        </div>
      )}

      {isSuperAdmin && syncResult && isInventoryTab && (
        <div className="mb-4 p-3 rounded-lg bg-purple-900/20 border border-purple-500/30 text-purple-200 text-sm">
          Catalog synced from blueprints: {syncResult.totalActive} active
          {syncResult.added > 0 && ` · ${syncResult.added} new`}
          {syncResult.reactivated > 0 && ` · ${syncResult.reactivated} reactivated`}
          {syncResult.deactivated > 0 && ` · ${syncResult.deactivated} deactivated`}
        </div>
      )}

      {orderError && activeTab === 'place-order' && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm">
          {orderError}
        </div>
      )}

      {activeTab === 'place-order' ? (
        user?.id ? (
          <ResourceBuyOrderPanel
            userId={user.id}
            blueprints={blueprints}
            catalog={catalog}
            labelMap={labelMap}
            onError={setOrderError}
            onSubmitted={() => {
              setOrderError(null)
              setActiveTab('personal')
            }}
          />
        ) : null
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">{tabLabel} · types</p>
              <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">In stock (types)</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{inStockCount}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Total SCU</p>
              <p className="text-2xl font-bold text-purple-400 mt-1 tabular-nums">
                {formatResourceQuantity(totalQty)}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources..."
              className="flex-1 px-3 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
            />
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-slate-300 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-500"
              />
              Show retired
            </label>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 border-t-2 border-b-2 border-red-500 rounded-full animate-spin mx-auto" />
              <p className="text-slate-400 mt-4">Loading resources...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredResources.map((resource) => {
                const isEditing = editingKey === resource.resource_key

                return (
                  <div
                    key={resource.resource_key}
                    className={`bg-gradient-to-br from-slate-900 to-slate-800 border rounded-xl p-4 ${
                      resource.is_active ? 'border-slate-700' : 'border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-white font-medium">{resource.label}</h3>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {resource.is_active
                            ? 'SCU in stock'
                            : 'Retired — no longer in blueprints'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs border ${
                          resource.quantity > 0
                            ? 'bg-green-950/50 text-green-400 border-green-500/30'
                            : 'bg-slate-800 text-slate-500 border-slate-600'
                        }`}
                      >
                        {resource.quantity > 0 ? 'In stock' : 'Empty'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      {isEditing && !readOnly ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            step={RESOURCE_QUANTITY_STEP}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-28 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm tabular-nums"
                          />
                          <span className="text-slate-500 text-xs">SCU</span>
                          <button
                            onClick={() => void handleSaveEdit(resource.resource_key)}
                            className="px-2 py-1 text-xs bg-green-900/50 text-green-300 border border-green-500/30 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingKey(null)
                              setEditValue('')
                            }}
                            className="px-2 py-1 text-xs text-slate-400"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-white tabular-nums">
                            {formatResourceQuantity(resource.quantity)}
                          </span>
                          <span className="text-slate-500 text-sm">SCU</span>
                          {!readOnly && (
                            <button
                              onClick={() => {
                                setEditingKey(resource.resource_key)
                                setEditValue(formatResourceQuantity(resource.quantity))
                              }}
                              className="text-xs text-slate-400 hover:text-white ml-1"
                            >
                              Set
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {resource.is_active && !readOnly && (
                      <div className="mt-3 grid grid-cols-2 gap-1.5">
                        {ADJUST_STEPS.map((step) => (
                          <div key={step} className="flex gap-1">
                            <button
                              onClick={() => void handleAdjust(resource.resource_key, -step)}
                              className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded"
                            >
                              −{step}
                            </button>
                            <button
                              onClick={() => void handleAdjust(resource.resource_key, step)}
                              className="flex-1 py-1 text-xs bg-red-950/50 hover:bg-red-900/50 text-red-300 border border-red-500/30 rounded"
                            >
                              +{step}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {isSuperAdmin && (
            <p className="text-slate-500 text-xs mt-6">
              Quantities are in SCU (3 decimal precision, matching in-game refining). Resource types
              come from <code>Blueprints.json</code> — use <strong className="text-slate-400">Sync
              from blueprints</strong> after updates.
            </p>
          )}
        </>
      )}

    </FeaturePageLayout>
  )
}
