// Supabase Edge Function: send-discord
// Processes Discord message queue and sends to webhooks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Discord embed colors
const COLORS = {
  orders: 0x22c55e,    // Green
  blueprints: 0xf97316, // Orange
  support: 0x3b82f6,   // Blue
  admin: 0xef4444,     // Red
}

interface DiscordSettings {
  enabled: boolean
  orders_enabled: boolean
  blueprints_enabled: boolean
  support_enabled: boolean
  admin_enabled: boolean
  official_webhook_url: string | null
  official_webhook_name: string | null
}

interface QueuedMessage {
  id: string
  event_type: 'orders' | 'blueprints' | 'support' | 'admin'
  title: string
  description: string | null
  color: number
  fields: Array<{ name: string; value: string; inline?: boolean }>
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Optional: Verify caller is super-admin (for manual triggers)
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
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

    // Get Discord settings
    const { data: settingsData, error: settingsError } = await supabase
      .rpc('get_discord_settings')

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

    // Get pending messages
    const { data: messages, error: msgError } = await supabase
      .rpc('get_pending_discord_messages', { p_limit: 50 })

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

      // Determine target webhooks based on event type
      const isOrgOnly = msg.event_type === 'support' || msg.event_type === 'admin'

      if (isOrgOnly) {
        // Org-only events go to official webhook only
        if (settings.official_webhook_url) {
          const success = await sendToWebhook(
            settings.official_webhook_url,
            embed,
            settings.official_webhook_name || 'Official'
          )
          if (success) sent++
        } else {
          console.log(`Skipping org-only message (${msg.event_type}): No official webhook configured`)
        }
      } else {
        // Public events go to all subscribed webhooks
        const { data: webhooks, error: webhookError } = await supabase
          .rpc('get_discord_webhooks_for_event', { p_event_type: msg.event_type })

        if (webhookError) {
          errors.push(`Failed to get webhooks for ${msg.event_type}: ${webhookError.message}`)
          continue
        }

        for (const webhook of (webhooks || []) as Webhook[]) {
          const success = await sendToWebhook(webhook.webhook_url, embed, webhook.webhook_name)
          
          // Record result
          await supabase.rpc('record_discord_webhook_result', {
            p_webhook_id: webhook.id,
            p_success: success
          })

          if (success) sent++

          // Rate limiting: Discord allows 30 requests per minute per webhook
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // Also send public events to official webhook if configured
        if (settings.official_webhook_url) {
          await sendToWebhook(
            settings.official_webhook_url,
            embed,
            settings.official_webhook_name || 'Official'
          )
        }
      }

      // Mark message as processed
      await supabase.rpc('mark_discord_message_processed', { p_message_id: msg.id })
      processed++
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        errors: errors.length > 0 ? errors : undefined
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
