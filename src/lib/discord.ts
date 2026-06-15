import { supabase } from './supabase'

// Discord embed colors
export const DISCORD_COLORS = {
  orders: 0x22c55e,           // Green (legacy)
  order_new: 0x22c55e,        // Green
  order_fulfilled: 0x3b82f6,  // Blue
  order_cancelled: 0xef4444,  // Red
  blueprints: 0xf97316,       // Orange
  support: 0x8b5cf6,          // Purple
  admin: 0xef4444,            // Red
  success: 0x22c55e,          // Green
  warning: 0xeab308,          // Yellow
  error: 0xef4444,            // Red
  info: 0x5865f2,             // Discord blurple
}

export type DiscordEventType = 'orders' | 'order_new' | 'order_fulfilled' | 'order_cancelled' | 'blueprints' | 'support' | 'admin'

export interface DiscordField {
  name: string
  value: string
  inline?: boolean
}

export interface DiscordSettings {
  enabled: boolean
  orders_enabled: boolean
  order_new_enabled: boolean
  order_fulfilled_enabled: boolean
  order_cancelled_enabled: boolean
  blueprints_enabled: boolean
  support_enabled: boolean
  admin_enabled: boolean
  official_webhook_url: string | null
  official_webhook_name: string | null
}

export interface DiscordWebhook {
  id: string
  webhook_url: string
  webhook_name: string
  subscribed_events: string[]
  registered_by: string | null
  created_at: string
  last_success_at: string | null
  failure_count: number
  active: boolean
}

export interface QueueStatus {
  pending_count: number
  oldest_pending: string | null
  processed_today: number
}

/**
 * Queue a Discord message for delivery
 */
export async function queueDiscordMessage(
  eventType: DiscordEventType,
  title: string,
  description?: string,
  color?: number,
  fields?: DiscordField[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('queue_discord_message', {
      p_event_type: eventType,
      p_title: title,
      p_description: description ?? null,
      p_color: color ?? DISCORD_COLORS[eventType],
      p_fields: fields ?? [],
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Get Discord settings (super-admin only)
 */
export async function getDiscordSettings(): Promise<{
  success: boolean
  settings?: DiscordSettings
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('get_discord_settings')

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No settings found' }
    }

    return { success: true, settings: data[0] as DiscordSettings }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Update Discord settings (super-admin only)
 */
export async function updateDiscordSettings(settings: Partial<{
  enabled: boolean
  orders_enabled: boolean
  order_new_enabled: boolean
  order_fulfilled_enabled: boolean
  order_cancelled_enabled: boolean
  blueprints_enabled: boolean
  support_enabled: boolean
  admin_enabled: boolean
  official_webhook_url: string
  official_webhook_name: string
}>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('update_discord_settings', {
      p_enabled: settings.enabled ?? null,
      p_orders_enabled: settings.orders_enabled ?? null,
      p_order_new_enabled: settings.order_new_enabled ?? null,
      p_order_fulfilled_enabled: settings.order_fulfilled_enabled ?? null,
      p_order_cancelled_enabled: settings.order_cancelled_enabled ?? null,
      p_blueprints_enabled: settings.blueprints_enabled ?? null,
      p_support_enabled: settings.support_enabled ?? null,
      p_admin_enabled: settings.admin_enabled ?? null,
      p_official_webhook_url: settings.official_webhook_url ?? null,
      p_official_webhook_name: settings.official_webhook_name ?? null,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Get queue status (super-admin only)
 */
export async function getDiscordQueueStatus(): Promise<{
  success: boolean
  status?: QueueStatus
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('get_discord_queue_status')

    if (error) {
      return { success: false, error: error.message }
    }

    // RPC returns a TABLE, so data is an array - get first row
    if (Array.isArray(data) && data.length > 0) {
      return { success: true, status: data[0] as QueueStatus }
    }

    return { success: true, status: data as QueueStatus }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Clear the message queue (super-admin only)
 */
export async function clearDiscordQueue(
  onlyProcessed: boolean = true
): Promise<{ success: boolean; deleted?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('clear_discord_queue', {
      p_only_processed: onlyProcessed,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, deleted: data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Get all registered webhooks (super-admin only)
 */
export async function getDiscordWebhooks(): Promise<{
  success: boolean
  webhooks?: DiscordWebhook[]
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('discord_webhooks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, webhooks: data as DiscordWebhook[] }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Toggle webhook active status (super-admin only)
 */
export async function toggleDiscordWebhook(
  webhookId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('discord_webhooks')
      .update({ active })
      .eq('id', webhookId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Delete a webhook (super-admin only)
 */
export async function deleteDiscordWebhook(
  webhookId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('discord_webhooks')
      .delete()
      .eq('id', webhookId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Register a webhook (authenticated users only)
 */
export async function registerDiscordWebhook(
  webhookUrl: string,
  webhookName: string,
  subscribedEvents: string[],
  registeredBy?: string
): Promise<{ success: boolean; webhookId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('register_discord_webhook', {
      p_webhook_url: webhookUrl,
      p_webhook_name: webhookName,
      p_subscribed_events: subscribedEvents,
      p_registered_by: registeredBy ?? null,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Function now returns JSONB with success/error fields
    if (data && typeof data === 'object') {
      if (data.success) {
        return { success: true, webhookId: data.webhook_id }
      } else {
        return { success: false, error: data.error || 'Registration failed' }
      }
    }

    return { success: true, webhookId: data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export interface UserWebhook {
  id: string
  webhook_name: string
  subscribed_events: string[]
  created_at: string
  last_success_at: string | null
  failure_count: number
  active: boolean
}

/**
 * Get current user's webhooks
 */
export async function getMyDiscordWebhooks(): Promise<{
  success: boolean
  webhooks?: UserWebhook[]
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('get_my_discord_webhooks')

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, webhooks: data as UserWebhook[] }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Delete one of user's own webhooks
 */
export async function deleteMyDiscordWebhook(
  webhookId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('delete_my_discord_webhook', {
      p_webhook_id: webhookId,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (data && typeof data === 'object') {
      return { success: data.success, error: data.error }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Update one of user's own webhooks
 */
export async function updateMyDiscordWebhook(
  webhookId: string,
  updates: { webhook_name?: string; subscribed_events?: string[] }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('update_my_discord_webhook', {
      p_webhook_id: webhookId,
      p_webhook_name: updates.webhook_name ?? null,
      p_subscribed_events: updates.subscribed_events ?? null,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (data && typeof data === 'object') {
      return { success: data.success, error: data.error }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Get enabled public event types (for subscription page)
 */
export async function getDiscordPublicEventTypes(): Promise<{
  success: boolean
  eventTypes?: Array<{ event_type: string; enabled: boolean }>
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('get_discord_public_event_types')

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, eventTypes: data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Trigger the send-discord edge function to process the queue
 */
export async function processDiscordQueue(): Promise<{
  success: boolean
  processed?: number
  sent?: number
  error?: string
}> {
  try {
    const { data, error } = await supabase.functions.invoke('send-discord')

    if (error) {
      return { success: false, error: error.message }
    }

    if (data?.error) {
      return { success: false, error: data.error }
    }

    return {
      success: true,
      processed: data?.processed ?? 0,
      sent: data?.sent ?? 0,
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// Convenience functions for queueing specific event types

export interface OrderEventDetails {
  orderTitle: string
  items: Array<{ name: string; quantity: number; unitAuec?: number }>
  totalAuec: number
}

export async function queueOrderEvent(
  action: 'created' | 'fulfilled' | 'cancelled',
  details: OrderEventDetails
) {
  const eventTypes: Record<string, DiscordEventType> = {
    created: 'order_new',
    fulfilled: 'order_fulfilled',
    cancelled: 'order_cancelled',
  }

  const titles: Record<string, string> = {
    created: 'New Order Placed',
    fulfilled: 'Order Accepted',
    cancelled: 'Order Cancelled',
  }

  const eventType = eventTypes[action]

  // Build item list string (max 5 items shown)
  const itemLines = details.items.slice(0, 5).map(item => {
    if (item.unitAuec) {
      return `• ${item.name} ×${item.quantity} (${item.unitAuec.toLocaleString()} aUEC ea)`
    }
    return `• ${item.name} ×${item.quantity}`
  })
  
  if (details.items.length > 5) {
    itemLines.push(`• ...and ${details.items.length - 5} more items`)
  }

  const description = itemLines.join('\n')

  const fields: DiscordField[] = [
    { name: 'Total Value', value: `${details.totalAuec.toLocaleString()} aUEC`, inline: true },
    { name: 'Items', value: details.items.length.toString(), inline: true },
  ]

  return queueDiscordMessage(
    eventType,
    `${titles[action]}: ${details.orderTitle}`,
    description,
    DISCORD_COLORS[eventType],
    fields
  )
}

export async function queueBlueprintSyncEvent(
  count: number,
  version: string
) {
  return queueDiscordMessage(
    'blueprints',
    'Blueprint Data Synced',
    `Successfully synced ${count.toLocaleString()} blueprints`,
    DISCORD_COLORS.blueprints,
    [
      { name: 'Blueprints', value: count.toLocaleString(), inline: true },
      { name: 'Version', value: version, inline: true },
    ]
  )
}

export async function queueSupportEvent(
  ticketId: string,
  category: string
) {
  return queueDiscordMessage(
    'support',
    'New Support Ticket',
    `A new support ticket has been submitted`,
    DISCORD_COLORS.support,
    [
      { name: 'Category', value: category, inline: true },
      { name: 'Ticket ID', value: ticketId.slice(0, 8), inline: true },
    ]
  )
}

export async function queueAdminEvent(
  title: string,
  description: string,
  isError: boolean = false
) {
  return queueDiscordMessage(
    'admin',
    title,
    description,
    isError ? DISCORD_COLORS.error : DISCORD_COLORS.info
  )
}
