import { supabase } from './supabase'
import {
  extractBlueprintResources,
  type BlueprintWithSlots,
  type ExtractedBlueprintResource,
} from './blueprintResources'
import { roundResourceQuantity } from './resourceQuantity'

export type CustomOrderStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'ready_for_pickup'
  | 'fulfilled'
  | 'completed'
  | 'cancelled'

export interface BlueprintResourceRow {
  resource_key: string
  label: string
  is_active: boolean
  synced_at: string
}

export type InventoryScope = 'personal' | 'org'

export interface InventoryContext {
  scope: InventoryScope
  userId: string
  orgId: string | null
}

export interface ResourceInventoryRow {
  id: string
  resource_key: string
  quantity: number
  updated_at: string
  updated_by: string | null
  user_id?: string
  org_id?: string
}

export interface ResourceCatalogEntry extends BlueprintResourceRow {
  quantity: number
}

export interface CustomOrderItem {
  id: string
  order_id: string
  resource_key: string
  quantity: number
}

export interface CustomOrderBlueprint {
  id: string
  order_id: string
  blueprint_id: string
  blueprint_title: string | null
  min_quality: number
  quantity: number
  unit_dfp_auec: number
  line_dfp_auec: number
  sort_order: number
}

export interface CustomOrderBlueprintInput {
  blueprintId: string
  blueprintTitle: string
  minQuality: number
  quantity: number
  unitDfpAuec: number
  lineDfpAuec: number
}

export interface CustomOrder {
  id: string
  requester_id: string
  title: string
  notes: string | null
  status: CustomOrderStatus
  blueprint_id: string | null
  min_quality: number
  quantity: number
  total_dfp_auec: number
  assignee_id: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
  items?: CustomOrderItem[]
  blueprints?: CustomOrderBlueprint[]
  requester?: {
    rsi_handle: string | null
    display_name: string | null
    email: string | null
  }
  assignee?: {
    rsi_handle: string | null
    display_name: string | null
    email: string | null
  }
}

export interface UserNotification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface OrderFulfillment {
  id: string
  order_id: string
  fulfilled_by: string | null
  notes: string | null
  created_at: string
  items?: { resource_key: string; quantity: number }[]
  order?: Pick<CustomOrder, 'title' | 'status' | 'total_dfp_auec'>
}

export interface ResourceCatalogSyncResult {
  added: number
  reactivated: number
  deactivated: number
  totalActive: number
}

export type ResourceMarketStatus = 'open' | 'filled' | 'sold' | 'cancelled'

export interface ResourceBuyRequest {
  id: string
  requester_id: string
  org_id: string | null
  resource_key: string
  resource_label: string
  min_quality: number
  quantity_scu: number
  dfp_total_auec: number
  notes: string | null
  status: ResourceMarketStatus
  created_at: string
  updated_at: string
  requester?: {
    rsi_handle: string | null
    display_name: string | null
    email: string | null
  }
}

export interface ResourceSaleListing {
  id: string
  seller_id: string
  org_id: string | null
  resource_key: string
  resource_label: string
  min_quality: number
  quantity_scu: number
  dfp_total_auec: number
  notes: string | null
  status: ResourceMarketStatus
  created_at: string
  updated_at: string
  seller?: {
    rsi_handle: string | null
    display_name: string | null
    email: string | null
  }
}

export async function syncBlueprintResourceCatalog(
  blueprints: BlueprintWithSlots[]
): Promise<{ result?: ResourceCatalogSyncResult; error?: string }> {
  const extracted = extractBlueprintResources(blueprints)
  const activeKeys = new Set(extracted.map((r) => r.resourceKey))
  const now = new Date().toISOString()

  if (extracted.length > 0) {
    const { error: upsertError } = await supabase.from('blueprint_resources').upsert(
      extracted.map((resource) => ({
        resource_key: resource.resourceKey,
        label: resource.label,
        is_active: true,
        synced_at: now,
      })),
      { onConflict: 'resource_key' }
    )

    if (upsertError) return { error: upsertError.message }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('blueprint_resources')
    .select('resource_key, is_active')

  if (fetchError) return { error: fetchError.message }

  const toDeactivate = (existing ?? [])
    .filter((row) => row.is_active && !activeKeys.has(row.resource_key))
    .map((row) => row.resource_key)

  if (toDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from('blueprint_resources')
      .update({ is_active: false, synced_at: now })
      .in('resource_key', toDeactivate)

    if (deactivateError) return { error: deactivateError.message }
  }

  // Inventory rows are seeded per user/org when the tracker loads scoped inventory.

  const priorKeys = new Set((existing ?? []).map((row) => row.resource_key))
  const added = extracted.filter((r) => !priorKeys.has(r.resourceKey)).length
  const reactivated = extracted.filter((r) => {
    const row = (existing ?? []).find((e) => e.resource_key === r.resourceKey)
    return row && !row.is_active
  }).length

  return {
    result: {
      added,
      reactivated,
      deactivated: toDeactivate.length,
      totalActive: extracted.length,
    },
  }
}

export async function fetchResourceCatalog(options?: {
  includeInactive?: boolean
}): Promise<{ data: BlueprintResourceRow[]; error?: string }> {
  let query = supabase
    .from('blueprint_resources')
    .select('*')
    .order('label')

  if (!options?.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as BlueprintResourceRow[] }
}

export async function seedScopedInventory(
  resourceKeys: string[],
  ctx: InventoryContext
): Promise<{ error?: string }> {
  if (resourceKeys.length === 0) return {}

  if (ctx.scope === 'personal') {
    const rows = resourceKeys.map((resource_key) => ({
      user_id: ctx.userId,
      org_id: ctx.orgId,
      resource_key,
      quantity: 0,
    }))
    const { error } = await supabase
      .from('personal_resource_inventory')
      .upsert(rows, { onConflict: 'user_id,resource_key', ignoreDuplicates: true })
    if (error) return { error: error.message }
    return {}
  }

  if (!ctx.orgId) return { error: 'Organization required for org inventory' }

  const rows = resourceKeys.map((resource_key) => ({
    org_id: ctx.orgId,
    resource_key,
    quantity: 0,
  }))
  const { error } = await supabase
    .from('org_resource_inventory')
    .upsert(rows, { onConflict: 'org_id,resource_key', ignoreDuplicates: true })
  if (error) return { error: error.message }
  return {}
}

export async function fetchResourceCatalogWithInventory(
  ctx: InventoryContext,
  options?: {
    includeInactive?: boolean
  }
): Promise<{ data: ResourceCatalogEntry[]; error?: string }> {
  const [catalogResult, inventoryResult] = await Promise.all([
    fetchResourceCatalog(options),
    fetchInventory(ctx),
  ])

  if (catalogResult.error) return { data: [], error: catalogResult.error }
  if (inventoryResult.error) return { data: [], error: inventoryResult.error }

  const activeKeys = catalogResult.data.map((r) => r.resource_key)
  await seedScopedInventory(activeKeys, ctx)

  const quantityByKey: Record<string, number> = {}
  inventoryResult.data.forEach((row) => {
    quantityByKey[row.resource_key] = Number(row.quantity)
  })

  const data = catalogResult.data.map((resource) => ({
    ...resource,
    quantity: quantityByKey[resource.resource_key] ?? 0,
  }))

  return { data }
}

function inventoryTable(scope: InventoryScope): string {
  return scope === 'personal' ? 'personal_resource_inventory' : 'org_resource_inventory'
}

export async function fetchInventory(ctx: InventoryContext): Promise<{
  data: ResourceInventoryRow[]
  error?: string
}> {
  if (ctx.scope === 'org' && !ctx.orgId) {
    return { data: [], error: 'Organization required for org inventory' }
  }

  let query = supabase.from(inventoryTable(ctx.scope)).select('*').order('resource_key')

  if (ctx.scope === 'personal') {
    query = query.eq('user_id', ctx.userId)
  } else {
    query = query.eq('org_id', ctx.orgId!)
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ResourceInventoryRow[] }
}

export async function adjustInventoryQuantity(
  ctx: InventoryContext,
  resourceKey: string,
  delta: number
): Promise<{ error?: string }> {
  if (ctx.scope === 'org' && !ctx.orgId) {
    return { error: 'Organization required for org inventory' }
  }

  const table = inventoryTable(ctx.scope)
  let fetchQuery = supabase.from(table).select('quantity').eq('resource_key', resourceKey)

  if (ctx.scope === 'personal') {
    fetchQuery = fetchQuery.eq('user_id', ctx.userId)
  } else {
    fetchQuery = fetchQuery.eq('org_id', ctx.orgId!)
  }

  const { data: current, error: fetchError } = await fetchQuery.maybeSingle()

  if (fetchError) return { error: fetchError.message }

  const nextQty = roundResourceQuantity(Math.max(0, Number(current?.quantity ?? 0) + delta))
  const now = new Date().toISOString()

  const row =
    ctx.scope === 'personal'
      ? {
          user_id: ctx.userId,
          org_id: ctx.orgId,
          resource_key: resourceKey,
          quantity: nextQty,
          updated_at: now,
        }
      : {
          org_id: ctx.orgId!,
          resource_key: resourceKey,
          quantity: nextQty,
          updated_at: now,
        }

  const { error } = await supabase.from(table).upsert(row, {
    onConflict: ctx.scope === 'personal' ? 'user_id,resource_key' : 'org_id,resource_key',
  })

  if (error) return { error: error.message }
  return {}
}

export async function setInventoryQuantity(
  ctx: InventoryContext,
  resourceKey: string,
  quantity: number
): Promise<{ error?: string }> {
  if (ctx.scope === 'org' && !ctx.orgId) {
    return { error: 'Organization required for org inventory' }
  }

  const table = inventoryTable(ctx.scope)
  const now = new Date().toISOString()
  const row =
    ctx.scope === 'personal'
      ? {
          user_id: ctx.userId,
          org_id: ctx.orgId,
          resource_key: resourceKey,
          quantity: roundResourceQuantity(Math.max(0, quantity)),
          updated_at: now,
        }
      : {
          org_id: ctx.orgId!,
          resource_key: resourceKey,
          quantity: roundResourceQuantity(Math.max(0, quantity)),
          updated_at: now,
        }

  const { error } = await supabase.from(table).upsert(row, {
    onConflict: ctx.scope === 'personal' ? 'user_id,resource_key' : 'org_id,resource_key',
  })

  if (error) return { error: error.message }
  return {}
}

export async function fetchResourceBuyRequests(): Promise<{
  data: ResourceBuyRequest[]
  error?: string
}> {
  const { data, error } = await supabase
    .from('resource_buy_requests')
    .select(`
      *,
      requester:profiles!resource_buy_requests_requester_id_fkey(rsi_handle, display_name, email)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ResourceBuyRequest[] }
}

export async function createResourceBuyRequest(input: {
  requesterId: string
  orgId: string | null
  resourceKey: string
  resourceLabel: string
  minQuality: number
  quantityScu: number
  dfpTotalAuec: number
  notes?: string
}): Promise<{ data?: ResourceBuyRequest; error?: string }> {
  const { data, error } = await supabase
    .from('resource_buy_requests')
    .insert({
      requester_id: input.requesterId,
      org_id: input.orgId,
      resource_key: input.resourceKey,
      resource_label: input.resourceLabel,
      min_quality: input.minQuality,
      quantity_scu: roundResourceQuantity(input.quantityScu),
      dfp_total_auec: Math.round(input.dfpTotalAuec),
      notes: input.notes?.trim() || null,
      status: 'open',
    })
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to post buy request' }
  return { data: data as ResourceBuyRequest }
}

export async function cancelResourceBuyRequest(requestId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('resource_buy_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) return { error: error.message }
  return {}
}

export async function fetchResourceSaleListings(): Promise<{
  data: ResourceSaleListing[]
  error?: string
}> {
  const { data, error } = await supabase
    .from('resource_sale_listings')
    .select(`
      *,
      seller:profiles!resource_sale_listings_seller_id_fkey(rsi_handle, display_name, email)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ResourceSaleListing[] }
}

export async function createResourceSaleListing(input: {
  sellerId: string
  orgId: string | null
  resourceKey: string
  resourceLabel: string
  minQuality: number
  quantityScu: number
  dfpTotalAuec: number
  notes?: string
}): Promise<{ data?: ResourceSaleListing; error?: string }> {
  const { data, error } = await supabase
    .from('resource_sale_listings')
    .insert({
      seller_id: input.sellerId,
      org_id: input.orgId,
      resource_key: input.resourceKey,
      resource_label: input.resourceLabel,
      min_quality: input.minQuality,
      quantity_scu: roundResourceQuantity(input.quantityScu),
      dfp_total_auec: Math.round(input.dfpTotalAuec),
      notes: input.notes?.trim() || null,
      status: 'open',
    })
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to post sale listing' }
  return { data: data as ResourceSaleListing }
}

export async function cancelResourceSaleListing(listingId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('resource_sale_listings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', listingId)

  if (error) return { error: error.message }
  return {}
}

export async function fetchCustomOrders(): Promise<{
  data: CustomOrder[]
  error?: string
}> {
  const { data, error } = await supabase
    .from('custom_orders')
    .select(`
      *,
      items:custom_order_items(*),
      blueprints:custom_order_blueprints(*),
      requester:profiles!custom_orders_requester_id_fkey(rsi_handle, display_name, email),
      assignee:profiles!custom_orders_assignee_id_fkey(rsi_handle, display_name, email)
    `)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as CustomOrder[] }
}

export async function createCustomOrder(input: {
  requesterId: string
  title: string
  notes?: string
  totalDfpAuec: number
  blueprints: CustomOrderBlueprintInput[]
  items: { resourceKey: string; quantity: number }[]
}): Promise<{ data?: CustomOrder; error?: string }> {
  if (input.blueprints.length === 0) {
    return { error: 'Add at least one blueprint to the order' }
  }

  const first = input.blueprints[0]
  const legacyBlueprintId = input.blueprints.length === 1 ? first.blueprintId : null

  const { data: order, error: orderError } = await supabase
    .from('custom_orders')
    .insert({
      requester_id: input.requesterId,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      blueprint_id: legacyBlueprintId,
      min_quality: first.minQuality,
      quantity: first.quantity,
      total_dfp_auec: Math.round(input.totalDfpAuec),
      status: 'pending',
    })
    .select()
    .single()

  if (orderError || !order) {
    return { error: orderError?.message ?? 'Failed to create order' }
  }

  const { error: blueprintsError } = await supabase.from('custom_order_blueprints').insert(
    input.blueprints.map((bp, index) => ({
      order_id: order.id,
      blueprint_id: bp.blueprintId,
      blueprint_title: bp.blueprintTitle,
      min_quality: bp.minQuality,
      quantity: bp.quantity,
      unit_dfp_auec: Math.round(bp.unitDfpAuec),
      line_dfp_auec: Math.round(bp.lineDfpAuec),
      sort_order: index,
    }))
  )

  if (blueprintsError) {
    await supabase.from('custom_orders').delete().eq('id', order.id)
    return { error: blueprintsError.message }
  }

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from('custom_order_items').insert(
      input.items.map((item) => ({
        order_id: order.id,
        resource_key: item.resourceKey,
        quantity: item.quantity,
      }))
    )

    if (itemsError) {
      await supabase.from('custom_orders').delete().eq('id', order.id)
      return { error: itemsError.message }
    }
  }

  return { data: order as CustomOrder }
}

export async function updateCustomOrderStatus(
  orderId: string,
  status: CustomOrderStatus
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('custom_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: error.message }
  return {}
}

export async function acceptCustomOrder(orderId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('accept_custom_order', { p_order_id: orderId })
  if (error) return { error: error.message }
  return {}
}

export async function startCustomOrderWork(orderId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('start_custom_order_work', { p_order_id: orderId })
  if (error) return { error: error.message }
  return {}
}

export async function completeOrderCraft(
  orderId: string,
  notes?: string
): Promise<{ fulfillmentId?: string; error?: string }> {
  const { data, error } = await supabase.rpc('complete_order_craft', {
    p_order_id: orderId,
    p_notes: notes ?? null,
  })

  if (error) return { error: error.message }
  return { fulfillmentId: data as string }
}

export async function confirmOrderPickup(orderId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('confirm_order_pickup', { p_order_id: orderId })
  if (error) return { error: error.message }
  return {}
}

export async function fetchUserNotifications(): Promise<{
  data: UserNotification[]
  error?: string
}> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as UserNotification[] }
}

export async function markNotificationRead(notificationId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)

  if (error) return { error: error.message }
  return {}
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return { error: error.message }
  return {}
}

/** @deprecated Use completeOrderCraft — kept for back-compat with fulfill_custom_order RPC */
export async function fulfillCustomOrder(
  orderId: string,
  notes?: string
): Promise<{ fulfillmentId?: string; error?: string }> {
  return completeOrderCraft(orderId, notes)
}

export async function fetchFulfillments(): Promise<{
  data: OrderFulfillment[]
  error?: string
}> {
  const { data, error } = await supabase
    .from('order_fulfillments')
    .select(`
      *,
      items:fulfillment_items(resource_key, quantity),
      order:custom_orders(title, status, total_dfp_auec)
    `)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as OrderFulfillment[] }
}

export type { ExtractedBlueprintResource }
