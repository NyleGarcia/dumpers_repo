// Supabase Edge Function: log-watcher-webhook
// Receives blueprint events from the BP Dumper desktop program
// Auth: Bearer API key (verify_jwt = false)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveBlueprintInput } from './resolveBlueprint.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AMBIGUOUS_DEDUPE_HOURS = 24

async function hasRecentAmbiguousNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  displayName: string
): Promise<boolean> {
  const since = new Date(Date.now() - AMBIGUOUS_DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('user_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'log_watcher_ambiguous_blueprint')
    .is('read_at', null)
    .gte('created_at', since)
    .contains('payload', { displayName })
    .limit(1)

  return (data?.length ?? 0) > 0
}

async function sendUserNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from('user_notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    payload,
  })
  if (error) {
    console.error('Failed to create notification:', error.message)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header. Provide Bearer <your_api_key>' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const apiKey = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: keyData, error: keyError } = await supabase
      .from('user_api_keys')
      .select('user_id')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (keyError || !keyData) {
      console.log('Invalid API key')
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = keyData.user_id

    const { data: banData } = await supabase
      .from('banned_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (banData) {
      console.log(`Banned user ${userId}`)
      return new Response(JSON.stringify({ error: 'User is banned' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (!profileData || profileData.role === 'pending') {
      console.log(`Pending approval user ${userId}`)
      return new Response(JSON.stringify({ error: 'Account pending approval' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'GET') {
      const { data: bpsData, error: bpsError } = await supabase
        .from('acquired_blueprints')
        .select('blueprint_id')
        .eq('user_id', userId)

      if (bpsError) {
        throw bpsError
      }

      const list = bpsData.map((row: { blueprint_id: string }) => row.blueprint_id)
      const minGameVersion = Deno.env.get('MIN_GAME_VERSION') ?? ''
      const latestDumperVersion = Deno.env.get('LATEST_DUMPER_VERSION') ?? '1.1.2'
      return new Response(JSON.stringify({ success: true, blueprints: list, minGameVersion, latestDumperVersion }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let payload
    try {
      payload = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payload.type === 'blueprint_received' && payload.blueprint) {
      const rawBlueprint = String(payload.blueprint).trim()
      if (!rawBlueprint || rawBlueprint.length > 200) {
        return new Response(JSON.stringify({ error: 'Invalid blueprint ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const contractDefinitionId = payload.contractDefinitionId
        ? String(payload.contractDefinitionId).trim()
        : null

      const resolved = resolveBlueprintInput(rawBlueprint, { contractDefinitionId })

      if (!resolved.ok) {
        if (resolved.error === 'unknown_blueprint') {
          return new Response(JSON.stringify({ error: 'Unknown blueprint', blueprint: rawBlueprint }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const displayName = resolved.displayName ?? rawBlueprint
        const alreadyNotified = await hasRecentAmbiguousNotification(supabase, userId, displayName)
        if (!alreadyNotified) {
          await sendUserNotification(
            supabase,
            userId,
            'log_watcher_ambiguous_blueprint',
            'BP Dumper: mark blueprint manually',
            `Could not auto-mark ${displayName}. Search for that name on Blueprints and mark the correct variant yourself.`,
            {
              displayName,
              rawInput: resolved.rawInput,
              candidates: (resolved.candidates ?? []).map((c) => c.internalName),
              link_to: '/blueprints',
              link_label: 'Mark on Blueprints',
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: 'ambiguous_blueprint',
            displayName,
            notificationSent: !alreadyNotified,
            candidates: (resolved.candidates ?? []).map((c) => c.internalName),
          }),
          {
            status: 202,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      const blueprintId = resolved.internalName
      const blueprintName = resolved.blueprintName

      const { error: insertError } = await supabase
        .from('acquired_blueprints')
        .insert({ user_id: userId, blueprint_id: blueprintId })

      if (insertError && insertError.code !== '23505') {
        throw insertError
      }

      const isDupe = insertError?.code === '23505'

      if (!isDupe) {
        await supabase
          .from('target_list_blueprints')
          .delete()
          .eq('user_id', userId)
          .eq('blueprint_id', blueprintId)

        await sendUserNotification(
          supabase,
          userId,
          'log_watcher_blueprint_acquired',
          'BP Dumper: blueprint acquired',
          `${blueprintName} was added to your acquired blueprints.`,
          {
            blueprintName,
            internalName: blueprintId,
            link_to: '/blueprints',
            link_label: 'View Blueprints',
          }
        )
      }

      await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('api_key', apiKey)

      return new Response(
        JSON.stringify({
          success: true,
          blueprint: blueprintId,
          blueprintName,
          duplicate: isDupe,
          resolvedVia: resolved.resolvedVia,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ message: 'Event type not handled' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Internal error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
