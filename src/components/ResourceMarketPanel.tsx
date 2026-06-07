import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DFP_QUALITY_TIERS } from '../config/dfp'
import { calculateMaterialDfpPrice, formatDfpAuec, formatDfpRequiredPrice } from '../lib/dfp'
import {
  cancelResourceBuyRequest,
  cancelResourceSaleListing,
  createResourceBuyRequest,
  createResourceSaleListing,
  fetchResourceBuyRequests,
  fetchResourceSaleListings,
  type ResourceBuyRequest,
  type ResourceCatalogEntry,
  type ResourceSaleListing,
} from '../lib/operations'
import {
  formatResourceQuantity,
  parseResourceQuantity,
  RESOURCE_QUANTITY_STEP,
} from '../lib/resourceQuantity'
import { getDisplayName } from '../lib/supabase'

interface ResourceMarketPanelProps {
  userId: string
  orgId: string | null
  catalog: ResourceCatalogEntry[]
}

export default function ResourceMarketPanel({
  userId,
  orgId,
  catalog,
}: ResourceMarketPanelProps) {
  const activeCatalog = useMemo(
    () => [...catalog].filter((r) => r.is_active).sort((a, b) => a.label.localeCompare(b.label)),
    [catalog]
  )

  const [buyRequests, setBuyRequests] = useState<ResourceBuyRequest[]>([])
  const [saleListings, setSaleListings] = useState<ResourceSaleListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [buyResourceKey, setBuyResourceKey] = useState('')
  const [buyQuality, setBuyQuality] = useState(String(DFP_QUALITY_TIERS[0]))
  const [buyQty, setBuyQty] = useState('1')
  const [buyNotes, setBuyNotes] = useState('')

  const [sellResourceKey, setSellResourceKey] = useState('')
  const [sellQuality, setSellQuality] = useState(String(DFP_QUALITY_TIERS[0]))
  const [sellQty, setSellQty] = useState('')
  const [sellNotes, setSellNotes] = useState('')

  const selectedBuyResource = activeCatalog.find((r) => r.resource_key === buyResourceKey)
  const selectedSellResource = activeCatalog.find((r) => r.resource_key === sellResourceKey)

  const buyQtyParsed = parseResourceQuantity(buyQty)
  const sellQtyParsed = parseResourceQuantity(sellQty)

  const buyDfp = useMemo(() => {
    if (!selectedBuyResource || buyQtyParsed == null || buyQtyParsed <= 0) return 0
    return calculateMaterialDfpPrice(
      selectedBuyResource.label,
      Number(buyQuality) || 500,
      buyQtyParsed
    )
  }, [selectedBuyResource, buyQtyParsed, buyQuality])

  const sellDfp = useMemo(() => {
    if (!selectedSellResource || sellQtyParsed == null || sellQtyParsed <= 0) return 0
    return calculateMaterialDfpPrice(
      selectedSellResource.label,
      Number(sellQuality) || 500,
      sellQtyParsed
    )
  }, [selectedSellResource, sellQtyParsed, sellQuality])

  const loadMarket = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [buyResult, sellResult] = await Promise.all([
      fetchResourceBuyRequests(),
      fetchResourceSaleListings(),
    ])
    if (buyResult.error) setError(buyResult.error)
    if (sellResult.error && !buyResult.error) setError(sellResult.error)
    setBuyRequests(buyResult.data)
    setSaleListings(sellResult.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadMarket()
  }, [loadMarket])

  useEffect(() => {
    if (buyResourceKey || activeCatalog.length === 0) return
    setBuyResourceKey(activeCatalog[0].resource_key)
  }, [activeCatalog, buyResourceKey])

  useEffect(() => {
    if (sellResourceKey || activeCatalog.length === 0) return
    const inStock = activeCatalog.find((r) => r.quantity > 0)
    setSellResourceKey((inStock ?? activeCatalog[0]).resource_key)
  }, [activeCatalog, sellResourceKey])

  const handlePostBuy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBuyResource || buyQtyParsed == null || buyQtyParsed <= 0) return

    setSubmitting(true)
    setError(null)
    const result = await createResourceBuyRequest({
      requesterId: userId,
      orgId,
      resourceKey: selectedBuyResource.resource_key,
      resourceLabel: selectedBuyResource.label,
      minQuality: Number(buyQuality) || 500,
      quantityScu: buyQtyParsed,
      dfpTotalAuec: buyDfp,
      notes: buyNotes,
    })
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setBuyQty('1')
    setBuyNotes('')
    await loadMarket()
  }

  const handlePostSell = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSellResource || sellQtyParsed == null || sellQtyParsed <= 0) return

    if (sellQtyParsed > selectedSellResource.quantity) {
      setError(
        `Cannot list ${formatResourceQuantity(sellQtyParsed)} SCU — you only have ${formatResourceQuantity(selectedSellResource.quantity)} in My Resources`
      )
      return
    }

    setSubmitting(true)
    setError(null)
    const result = await createResourceSaleListing({
      sellerId: userId,
      orgId,
      resourceKey: selectedSellResource.resource_key,
      resourceLabel: selectedSellResource.label,
      minQuality: Number(sellQuality) || 500,
      quantityScu: sellQtyParsed,
      dfpTotalAuec: sellDfp,
      notes: sellNotes,
    })
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSellQty('')
    setSellNotes('')
    await loadMarket()
  }

  const profileLabel = (fields?: {
    rsi_handle: string | null
    display_name: string | null
    email: string | null
  }) =>
    getDisplayName(
      fields
        ? {
            id: '',
            rsi_handle: fields.rsi_handle,
            display_name: fields.display_name,
            email: fields.email,
            avatar_url: null,
            role: 'member',
            created_at: '',
            approved_at: null,
            approved_by: null,
            ghost_mode: false,
            preview_features_enabled: false,
            fulfillment_enabled: false,
            share_personal_resources: false,
          }
        : null
    )

  return (
    <div className="space-y-8">
      <p className="text-slate-400 text-sm">
        Post what you want to <strong className="text-slate-300">buy</strong> or{' '}
        <strong className="text-slate-300">sell</strong>. Prices use material-only DFP (quality tier
        + SCU + rarity) — no blueprint craft markup. Quantities are in SCU (up to 3 decimals, like
        in-game refining). Arrange payment and delivery in-game.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-4">
          <h2 className="text-white font-medium">Looking to buy</h2>
          <form onSubmit={(e) => void handlePostBuy(e)} className="space-y-3">
            <select
              value={buyResourceKey}
              onChange={(e) => setBuyResourceKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
            >
              {activeCatalog.map((r) => (
                <option key={r.resource_key} value={r.resource_key}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 text-xs">Min quality tier</label>
                <select
                  value={buyQuality}
                  onChange={(e) => setBuyQuality(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                >
                  {DFP_QUALITY_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 text-xs">Quantity (SCU)</label>
                <input
                  type="number"
                  min={RESOURCE_QUANTITY_STEP}
                  step={RESOURCE_QUANTITY_STEP}
                  value={buyQty}
                  onChange={(e) => setBuyQty(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
            </div>
            {buyDfp > 0 && (
              <p className="text-amber-200 text-sm font-medium">
                Offer price: {formatDfpRequiredPrice(buyDfp)}
              </p>
            )}
            <input
              value={buyNotes}
              onChange={(e) => setBuyNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
            />
            <button
              type="submit"
              disabled={submitting || buyDfp <= 0}
              className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              Post buy request
            </button>
          </form>

          <div className="border-t border-slate-700 pt-3 space-y-2">
            <h3 className="text-slate-400 text-xs uppercase tracking-wide">Open buy requests</h3>
            {loading ? (
              <p className="text-slate-500 text-sm">Loading...</p>
            ) : buyRequests.length === 0 ? (
              <p className="text-slate-500 text-sm">No open buy requests.</p>
            ) : (
              buyRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-white font-medium">{req.resource_label}</span>
                    <span className="text-amber-300 shrink-0">
                      {formatDfpAuec(Number(req.dfp_total_auec))}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">
                    {formatResourceQuantity(Number(req.quantity_scu))} SCU · Q{req.min_quality} ·{' '}
                    {profileLabel(req.requester)}
                  </p>
                  {req.requester_id === userId && (
                    <button
                      type="button"
                      onClick={() => void cancelResourceBuyRequest(req.id).then(() => loadMarket())}
                      className="text-xs text-red-400 mt-2 hover:text-red-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-4">
          <h2 className="text-white font-medium">For sale</h2>
          <form onSubmit={(e) => void handlePostSell(e)} className="space-y-3">
            <select
              value={sellResourceKey}
              onChange={(e) => setSellResourceKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
            >
              {activeCatalog.map((r) => (
                <option key={r.resource_key} value={r.resource_key}>
                  {r.label} — {formatResourceQuantity(r.quantity)} SCU on hand
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 text-xs">Quality tier</label>
                <select
                  value={sellQuality}
                  onChange={(e) => setSellQuality(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                >
                  {DFP_QUALITY_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 text-xs">Quantity (SCU)</label>
                <input
                  type="number"
                  min={RESOURCE_QUANTITY_STEP}
                  step={RESOURCE_QUANTITY_STEP}
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                  placeholder="0.001"
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
            </div>
            {sellDfp > 0 && (
              <p className="text-amber-200 text-sm font-medium">
                Asking price: {formatDfpRequiredPrice(sellDfp)}
              </p>
            )}
            <input
              value={sellNotes}
              onChange={(e) => setSellNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
            />
            <button
              type="submit"
              disabled={submitting || sellDfp <= 0}
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              Post sale listing
            </button>
          </form>

          <div className="border-t border-slate-700 pt-3 space-y-2">
            <h3 className="text-slate-400 text-xs uppercase tracking-wide">Open listings</h3>
            {loading ? (
              <p className="text-slate-500 text-sm">Loading...</p>
            ) : saleListings.length === 0 ? (
              <p className="text-slate-500 text-sm">No open sale listings.</p>
            ) : (
              saleListings.map((listing) => (
                <div
                  key={listing.id}
                  className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-white font-medium">{listing.resource_label}</span>
                    <span className="text-amber-300 shrink-0">
                      {formatDfpAuec(Number(listing.dfp_total_auec))}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">
                    {formatResourceQuantity(Number(listing.quantity_scu))} SCU · Q
                    {listing.min_quality} · {profileLabel(listing.seller)}
                  </p>
                  {listing.seller_id === userId && (
                    <button
                      type="button"
                      onClick={() =>
                        void cancelResourceSaleListing(listing.id).then(() => loadMarket())
                      }
                      className="text-xs text-red-400 mt-2 hover:text-red-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
