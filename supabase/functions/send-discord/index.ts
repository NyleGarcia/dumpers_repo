// Supabase Edge Function: send-discord
// Processes Discord message queue and sends to webhooks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COLORS: Record<string, number> = {
  orders: 0x22c55e,
  order_new: 0x22c55e,
  order_fulfilled: 0x3b82f6,
  order_cancelled: 0xef4444,
  market_wtb_new: 0x22c55e,
  market_wts_new: 0x10b981,
  market_accepted: 0x3b82f6,
  market_cancelled: 0xef4444,
  market_coalesced: 0xf59e0b,
  my_order_accepted: 0x3b82f6,
  my_order_in_progress: 0x6366f1,
  my_order_ready: 0xf59e0b,
  my_order_completed: 0x22c55e,
  my_order_cancelled: 0xef4444,
  my_order_released: 0xef4444,
  my_order_timeout: 0xef4444,
  my_order_noshow: 0xef4444,
  my_order_dispute: 0xef4444,
  my_support_reply: 0x8b5cf6,
  my_support_resolved: 0x22c55e,
  support: 0x8b5cf6,
  admin: 0xef4444,
}

interface DiscordSettings {
  enabled: boolean
  orders_enabled: boolean
  order_new_enabled: boolean
  order_fulfilled_enabled: boolean
  order_cancelled_enabled: boolean
  blueprints_enabled: boolean
  support_enabled: boolean
  admin_enabled: boolean
  personal_discord_enabled: boolean
  market_coalesce_enabled: boolean
  market_coalesce_minutes: number
  official_webhook_url: string | null
  official_webhook_name: string | null
}

interface QueuedMessage {
  id: string
  event_type: string
  title: string
  description: string | null
  color: number
  fields: Array<{ name: string; value: string; inline?: boolean }>
  target_user_id: string | null
  actor_user_id: string | null
  created_at: string
}

interface Webhook {
  id: string
  webhook_url: string
  webhook_name: string
}

interface DiscordEmbed {
  title: string
  description?: string
  color: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
  timestamp?: string
}

function isStaffEvent(eventType: string): boolean {
  return eventType === 'support' || eventType === 'admin'
}

function isPersonalEvent(eventType: string): boolean {
  return eventType.startsWith('my_')
}

function isMarketEvent(eventType: string): boolean {
  return eventType.startsWith('market_')
}

function isLegacyPublicEvent(eventType: string): boolean {
  return ['orders', 'order_new', 'order_fulfilled', 'order_cancelled'].includes(eventType)
}

async function sendToWebhook(
  webhookUrl: string,
  embed: DiscordEmbed,
  webhookName: string
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: "Dumper's Repo",
        embeds: [embed],
      }),
    })

    if (response.status === 204 || response.ok) {
      console.log(`Successfully sent to ${webhookName}`)
      return true
    }

    console.error(`Failed to send to ${webhookName}: ${response.status}`)
    return false
  } catch (error) {
    console.error(`Error sending to ${webhookName}:`, error)
    return false
  }
}

async function deliverToWebhooks(
  supabase: ReturnType<typeof createClient>,
  webhooks: Webhook[],
  embed: DiscordEmbed
): Promise<number> {
  let sent = 0

  for (const webhook of webhooks) {
    const success = await sendToWebhook(webhook.webhook_url, embed, webhook.webhook_name)

    await supabase.rpc('record_discord_webhook_result', {
      p_webhook_id: webhook.id,
      p_success: success,
    })

    if (success) sent++
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return sent
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user }, error: authError } = await userClient.auth.getUser()

      if (!authError && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'super-admin') {
          return new Response(
            JSON.stringify({ error: 'Super-admin access required for manual trigger' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    const { data: settingsData, error: settingsError } = await supabase.rpc('get_discord_settings')

    if (settingsError || !settingsData || settingsData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to get Discord settings', details: settingsError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const settings = settingsData[0] as DiscordSettings

    if (!settings.enabled) {
      return new Response(
        JSON.stringify({ message: 'Discord integration is disabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: messages, error: msgError } = await supabase.rpc('get_pending_discord_messages', {
      p_limit: 50,
    })

    if (msgError) {
      return new Response(
        JSON.stringify({ error: 'Failed to get pending messages', details: msgError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending messages', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${messages.length} pending messages`)

    let processed = 0
    let sent = 0
    const errors: string[] = []

    for (const msg of messages as QueuedMessage[]) {
      const embed: DiscordEmbed = {
        title: msg.title,
        description: msg.description || undefined,
        color: msg.color || COLORS[msg.event_type] || 0x5865f2,
        fields: msg.fields || undefined,
        footer: { text: `Dumper's Repo • ${msg.event_type}` },
        timestamp: msg.created_at,
      }

      if (isStaffEvent(msg.event_type)) {
        if (settings.official_webhook_url) {
          const success = await sendToWebhook(
            settings.official_webhook_url,
            embed,
            settings.official_webhook_name || 'Official'
          )
          if (success) sent++
        } else {
          console.log(`Skipping staff message (${msg.event_type}): No official webhook configured`)
        }
      } else if (isPersonalEvent(msg.event_type)) {
        if (!msg.target_user_id) {
          console.log(`Skipping personal message (${msg.event_type}): missing target_user_id`)
        } else {
          const { data: webhooks, error: webhookError } = await supabase.rpc(
            'get_discord_webhooks_for_personal_event',
            { p_event_type: msg.event_type, p_target_user_id: msg.target_user_id }
          )

          if (webhookError) {
            errors.push(`Failed to get personal webhooks for ${msg.event_type}: ${webhookError.message}`)
          } else {
            sent += await deliverToWebhooks(supabase, (webhooks || []) as Webhook[], embed)
          }
        }
      } else if (isMarketEvent(msg.event_type)) {
        const { data: webhooks, error: webhookError } = await supabase.rpc(
          'get_discord_webhooks_for_market_event',
          { p_event_type: msg.event_type, p_exclude_user_id: msg.actor_user_id }
        )

        if (webhookError) {
          errors.push(`Failed to get market webhooks for ${msg.event_type}: ${webhookError.message}`)
        } else {
          sent += await deliverToWebhooks(supabase, (webhooks || []) as Webhook[], embed)
        }
      } else if (isLegacyPublicEvent(msg.event_type)) {
        const { data: webhooks, error: webhookError } = await supabase.rpc(
          'get_discord_webhooks_for_event',
          { p_event_type: msg.event_type }
        )

        if (webhookError) {
          errors.push(`Failed to get webhooks for ${msg.event_type}: ${webhookError.message}`)
        } else {
          sent += await deliverToWebhooks(supabase, (webhooks || []) as Webhook[], embed)
        }
      } else {
        console.log(`Skipping unknown event type: ${msg.event_type}`)
      }

      await supabase.rpc('mark_discord_message_processed', { p_message_id: msg.id })
      processed++
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Send Discord error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
