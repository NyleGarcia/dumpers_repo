// Supabase Edge Function: sync-shop-data
// Fetches shop data from UEX Corp API and updates Supabase tables

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UEX_TERMINALS_URL = 'https://api.uexcorp.space/2.0/terminals'
const UEX_ITEMS_PRICES_URL = 'https://api.uexcorp.space/2.0/items_prices_all'

// UEX Terminal structure
interface UEXTerminal {
  id: number
  id_star_system: number
  id_planet: number
  id_orbit: number
  id_moon: number
  id_space_station: number
  id_outpost: number
  id_poi: number
  id_city: number
  id_faction: number
  name: string
  fullname: string
  nickname: string
  code: string
  type: string
  is_available: number
  is_visible: number
  is_shop_fps: number
  is_shop_vehicle: number
  is_refinery: number
  is_cargo_center: number
  is_habitation: number
  is_medical: number
  is_food: number
  is_refuel: number
  is_repair: number
  is_nqa: number
  is_player_owned: number
  game_version: string | null
  star_system_name: string | null
  planet_name: string | null
  orbit_name: string | null
  moon_name: string | null
  space_station_name: string | null
  outpost_name: string | null
  city_name: string | null
  faction_name: string | null
}

// UEX Item Price structure
interface UEXItemPrice {
  id: number
  id_item: number
  id_terminal: number
  id_category: number
  price_buy: number | null
  price_sell: number | null
  date_added: number
  date_modified: number
  item_name: string
  item_uuid: string | null
  terminal_name: string
}

// Component types we want to track for price summaries
const COMPONENT_TYPES = new Set([
  'weapons',
  'turrets',
  'missiles',
  'shields',
  'power_plants',
  'coolers',
  'quantum_drives',
  'radar',
  'emp',
  'mining_lasers',
  'qig',
  'tractors',
  'utility',
  'paints',
  'undersuits',
  'armor',
  'fps_weapons',
  'medical',
  'mining_gadgets',
  'personal',
  'multitools',
])

// Determine location type from terminal properties
function getLocationType(terminal: UEXTerminal): string {
  if (terminal.is_refinery) return 'refinery'
  if (terminal.space_station_name) {
    if (terminal.space_station_name.includes('L1') || 
        terminal.space_station_name.includes('L2') ||
        terminal.space_station_name.includes('L3') ||
        terminal.space_station_name.includes('L4') ||
        terminal.space_station_name.includes('L5')) {
      return 'rest_stop'
    }
    return 'orbital'
  }
  if (terminal.city_name) return 'city'
  if (terminal.outpost_name) return 'outpost'
  if (terminal.is_nqa) return 'nqa'
  if (terminal.is_player_owned) return 'player_owned'
  return 'unknown'
}

// Get the most specific location name
function getLocationName(terminal: UEXTerminal): string {
  return terminal.city_name || 
         terminal.space_station_name || 
         terminal.outpost_name || 
         terminal.moon_name || 
         terminal.planet_name || 
         terminal.orbit_name ||
         'Unknown'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is super-admin
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
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

    // Update sync status to 'syncing'
    await supabase
      .from('shop_data_sync_status')
      .update({ sync_status: 'syncing', sync_error: null, updated_at: new Date().toISOString() })
      .eq('id', 1)

    console.log('Fetching terminals from UEX API...')

    // Fetch terminals
    const terminalsResponse = await fetch(UEX_TERMINALS_URL, {
      headers: { 
        'User-Agent': 'DumpersRepo-Sync',
        'Accept': 'application/json'
      }
    })

    if (!terminalsResponse.ok) {
      throw new Error(`Failed to fetch UEX terminals: ${terminalsResponse.status}`)
    }

    const terminalsData = await terminalsResponse.json()
    const terminals: UEXTerminal[] = terminalsData.data || terminalsData
    console.log(`Fetched ${terminals.length} terminals from UEX`)

    // Filter to shop terminals only (fps items or vehicle items)
    const shopTerminals = terminals.filter(t => 
      (t.is_shop_fps || t.is_shop_vehicle) && 
      t.is_available && 
      t.is_visible &&
      t.star_system_name
    )
    console.log(`${shopTerminals.length} are shop terminals`)

    console.log('Fetching item prices from UEX API...')

    // Fetch all item prices
    const pricesResponse = await fetch(UEX_ITEMS_PRICES_URL, {
      headers: { 
        'User-Agent': 'DumpersRepo-Sync',
        'Accept': 'application/json'
      }
    })

    if (!pricesResponse.ok) {
      throw new Error(`Failed to fetch UEX item prices: ${pricesResponse.status}`)
    }

    const pricesData = await pricesResponse.json()
    const allPrices: UEXItemPrice[] = pricesData.data || pricesData
    console.log(`Fetched ${allPrices.length} item prices from UEX`)

    // Build a map of terminal_id -> prices
    const pricesByTerminal = new Map<number, UEXItemPrice[]>()
    for (const price of allPrices) {
      const existing = pricesByTerminal.get(price.id_terminal)
      if (existing) {
        existing.push(price)
      } else {
        pricesByTerminal.set(price.id_terminal, [price])
      }
    }

    // Clear existing data
    console.log('Clearing existing shop data...')
    await supabase.from('shop_inventory').delete().neq('id', 0)
    await supabase.from('shops').delete().neq('id', 0)
    await supabase.from('component_price_summary').delete().neq('id', 0)

    // Process shops and inventory
    let shopCount = 0
    let totalInventoryCount = 0
    const componentPrices: Map<string, { type: string; prices: number[] }> = new Map()

    for (const terminal of shopTerminals) {
      // Get prices for this terminal - skip if empty
      const terminalPrices = pricesByTerminal.get(terminal.id) || []
      if (terminalPrices.length === 0) {
        continue // Skip shops with no inventory
      }

      const system = terminal.star_system_name || 'Unknown'
      const location = getLocationName(terminal)
      const locationType = getLocationType(terminal)

      // Insert shop (only if it has inventory)
      const { data: insertedShop, error: shopError } = await supabase
        .from('shops')
        .insert({
          shop_reference: `uex-${terminal.id}`,
          name: terminal.fullname || terminal.name,
          container_path: terminal.code || '',
          system,
          location,
          location_type: locationType,
          accepts_stolen_goods: terminal.is_nqa === 1,
          profit_margin: 0, // UEX provides final prices
        })
        .select('id')
        .single()

      if (shopError || !insertedShop) {
        console.error(`Failed to insert shop ${terminal.name}:`, shopError)
        continue
      }

      shopCount++
      const shopId = insertedShop.id

      // Process inventory
      {
        const inventoryRows = terminalPrices.map((item) => {
          const sellPrice = item.price_sell || 0
          const buyPrice = item.price_buy || 0
          const effectivePrice = sellPrice > 0 ? sellPrice : buyPrice

          // Track component prices for summary
          if (sellPrice > 0 && item.item_name) {
            const existing = componentPrices.get(item.item_name)
            if (existing) {
              existing.prices.push(sellPrice)
            } else {
              componentPrices.set(item.item_name, { type: 'item', prices: [sellPrice] })
            }
          }

          return {
            shop_id: shopId,
            item_name: item.item_uuid || `uex-${item.id_item}`,
            display_name: item.item_name,
            item_type: null, // UEX doesn't provide type in prices_all
            sub_type: null,
            base_price: effectivePrice,
            effective_price: effectivePrice,
            base_price_offset_pct: 0,
            shop_buys: (buyPrice || 0) > 0,
            shop_sells: (sellPrice || 0) > 0,
            shop_rents: false,
            item_reference: item.item_uuid || null,
            tags: null,
          }
        })

        // Insert in batches of 500
        const batchSize = 500
        for (let i = 0; i < inventoryRows.length; i += batchSize) {
          const batch = inventoryRows.slice(i, i + batchSize)
          const { error: invError } = await supabase.from('shop_inventory').insert(batch)
          if (invError) {
            console.error(`Failed to insert inventory batch for ${terminal.name}:`, invError)
          }
        }

        totalInventoryCount += inventoryRows.length
      }
    }

    console.log(`Inserted ${shopCount} shops and ${totalInventoryCount} inventory items`)

    // Insert component price summaries
    console.log(`Computing price summaries for ${componentPrices.size} components...`)
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
        const batch = priceSummaries.slice(i, i + batchSize)
        await supabase.from('component_price_summary').insert(batch)
      }
    }

    // Get version from first terminal's game_version
    const version = shopTerminals[0]?.game_version || 'unknown'

    // Update sync status to success
    await supabase
      .from('shop_data_sync_status')
      .update({
        sync_status: 'success',
        last_synced_at: new Date().toISOString(),
        source_url: 'UEX Corp API (uexcorp.space)',
        source_version: version,
        shop_count: shopCount,
        inventory_count: totalInventoryCount,
        sync_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1)

    return new Response(
      JSON.stringify({
        success: true,
        version,
        source: 'UEX Corp API',
        counts: {
          terminals: terminals.length,
          shopTerminals: shopTerminals.length,
          shops: shopCount,
          inventory: totalInventoryCount,
          componentPriceSummaries: priceSummaries.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)

    // Update sync status to error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      await supabase
        .from('shop_data_sync_status')
        .update({
          sync_status: 'error',
          sync_error: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1)
    } catch (_) {
      // Ignore error update failure
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
