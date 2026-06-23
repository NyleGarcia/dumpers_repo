// Supabase Edge Function: sync-shop-data
// Loads parsed game shop data (game-shops.json) into Supabase tables

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import gameShopsData from './game-shops.json' assert { type: 'json' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GameShopInventoryItem {
  itemName: string
  displayName: string
  itemType?: string | null
  recordName?: string | null
  basePrice?: number | null
  effectivePrice?: number | null
  shopSells?: boolean
  shopBuys?: boolean
  shopRents?: boolean
  priceKnown?: boolean
}

interface GameShop {
  shopReference: string
  name: string
  socpakPath: string
  entityGuid: string
  system: string
  site: string | null
  location: string | null
  locationType: string | null
  shopCategory: string | null
  franchise: string | null
  shopKind: string | null
  shopInteraction?: string | null
  inventoryExpected?: boolean
  inventory: GameShopInventoryItem[]
}

interface GameShopsFile {
  gameBuild?: string | null
  shops: GameShop[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super-admin') {
      return new Response(
        JSON.stringify({ error: 'Super-admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await supabase
      .from('shop_data_sync_status')
      .update({ sync_status: 'syncing', sync_error: null, updated_at: new Date().toISOString() })
      .eq('id', 1)

    const payload = gameShopsData as GameShopsFile
    const gameShops = payload.shops || []

    console.log(`Loading ${gameShops.length} shops from game-shops.json`)

    await supabase.from('shop_inventory').delete().neq('id', 0)
    await supabase.from('shops').delete().neq('id', 0)
    await supabase.from('component_price_summary').delete().neq('id', 0)

    let shopCount = 0
    let totalInventoryCount = 0
    const componentPrices = new Map<string, { type: string | null; prices: number[] }>()

    for (const shop of gameShops) {
      const { data: insertedShop, error: shopError } = await supabase
        .from('shops')
        .insert({
          shop_reference: shop.shopReference,
          name: shop.name,
          container_path: shop.socpakPath,
          system: shop.system || 'Unknown',
          site: shop.site,
          location: shop.location,
          location_type: shop.locationType,
          shop_category: shop.shopCategory,
          franchise: shop.franchise,
          shop_kind: shop.shopKind || 'item',
          shop_interaction: shop.shopInteraction || 'kiosk',
          inventory_expected: shop.inventoryExpected !== false,
          socpak_path: shop.socpakPath,
          entity_guid: shop.entityGuid,
          game_build: payload.gameBuild || null,
          accepts_stolen_goods: false,
          profit_margin: 0,
        })
        .select('id')
        .single()

      if (shopError || !insertedShop) {
        console.error(`Failed to insert shop ${shop.name}:`, shopError)
        continue
      }

      shopCount++
      const shopId = insertedShop.id

      const inventoryRows = (shop.inventory || []).map((item) => {
        const price = item.effectivePrice ?? item.basePrice ?? null
        const hasPrice = price != null && price > 0

        if (hasPrice && item.displayName && item.shopSells) {
          const existing = componentPrices.get(item.displayName)
          if (existing) {
            existing.prices.push(price)
          } else {
            componentPrices.set(item.displayName, {
              type: item.itemType || null,
              prices: [price],
            })
          }
        }

        return {
          shop_id: shopId,
          item_name: item.itemName,
          display_name: item.displayName,
          item_type: item.itemType || null,
          sub_type: null,
          base_price: hasPrice ? price : null,
          effective_price: hasPrice ? price : null,
          base_price_offset_pct: 0,
          shop_buys: item.shopBuys ?? false,
          shop_sells: item.shopSells ?? (hasPrice ? true : false),
          shop_rents: item.shopRents ?? false,
          item_reference: item.itemName,
          tags: null,
        }
      })

      if (inventoryRows.length > 0) {
        const batchSize = 500
        for (let i = 0; i < inventoryRows.length; i += batchSize) {
          const batch = inventoryRows.slice(i, i + batchSize)
          const { error: invError } = await supabase.from('shop_inventory').insert(batch)
          if (invError) {
            console.error(`Failed to insert inventory for ${shop.name}:`, invError)
          }
        }
        totalInventoryCount += inventoryRows.length
      }
    }

    const priceSummaries = Array.from(componentPrices.entries()).map(([name, data]) => {
      const prices = data.prices.sort((a, b) => a - b)
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      return {
        component_name: name,
        component_type: data.type,
        avg_price: avg,
        min_price: prices[0],
        max_price: prices[prices.length - 1],
        shop_count: prices.length,
      }
    })

    if (priceSummaries.length > 0) {
      const batchSize = 200
      for (let i = 0; i < priceSummaries.length; i += batchSize) {
        await supabase.from('component_price_summary').insert(priceSummaries.slice(i, i + batchSize))
      }
    }

    const version = payload.gameBuild || 'unknown'

    await supabase
      .from('shop_data_sync_status')
      .update({
        sync_status: 'success',
        last_synced_at: new Date().toISOString(),
        source_url: 'game-files://socpak',
        source_version: version,
        shop_count: shopCount,
        inventory_count: totalInventoryCount,
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    return new Response(
      JSON.stringify({
        success: true,
        version,
        source: 'game-files (socpak + ShopInventories)',
        counts: {
          shops: shopCount,
          inventory: totalInventoryCount,
          componentPriceSummaries: priceSummaries.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Sync error:', error)

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      await supabase
        .from('shop_data_sync_status')
        .update({
          sync_status: 'error',
          sync_error: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
    } catch (_) {
      // ignore
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
