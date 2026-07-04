// Supabase Edge Function: log-watcher-webhook
// Receives blueprint events from external tools (e.g. Log Watcher)
// Auth: Bearer API key (verify_jwt = false)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'



const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
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

    // Lookup user by API key
    const { data: keyData, error: keyError } = await supabase
      .from('user_api_keys')
      .select('user_id')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (keyError || !keyData) {
      console.log(`✗ Invalid API key (key=${apiKey.slice(0, 8)}…)`)
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = keyData.user_id
    console.log(`→ Authenticated user=${userId.slice(0, 8)}…`)

    // Check ban status
    const { data: banData } = await supabase
      .from('banned_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (banData) {
      console.log(`✗ Banned user user=${userId.slice(0, 8)}…`)
      return new Response(JSON.stringify({ error: 'User is banned' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check pending status
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (!profileData || profileData.role === 'pending') {
      console.log(`⏳ Pending approval user=${userId.slice(0, 8)}…`)
      return new Response(JSON.stringify({ error: 'Account pending approval' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse payload
    let payload
    try {
      payload = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Expected: { "type": "blueprint_received", "blueprint": "some_id" }
    if (payload.type === 'blueprint_received' && payload.blueprint) {
      const blueprintId = String(payload.blueprint).trim()
      if (!blueprintId || blueprintId.length > 200) {
        return new Response(JSON.stringify({ error: 'Invalid blueprint ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Insert blueprint (ignore duplicates)
      const { error: insertError } = await supabase
        .from('acquired_blueprints')
        .insert({ user_id: userId, blueprint_id: blueprintId })

      if (insertError && insertError.code !== '23505') {
        throw insertError
      }

      const isDupe = insertError?.code === '23505'
      if (isDupe) {
        console.log(`↻ Blueprint already acquired: ${blueprintId} user=${userId.slice(0, 8)}…`)
      } else {
        console.log(`★ Blueprint received: ${blueprintId} user=${userId.slice(0, 8)}…`)
      }

      // Clear from mission tracker targets (mirrors UI toggleAcquired behavior)
      await supabase
        .from('target_list_blueprints')
        .delete()
        .eq('user_id', userId)
        .eq('blueprint_id', blueprintId)

      // Update last_used_at
      await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('api_key', apiKey)

      return new Response(JSON.stringify({ success: true, blueprint: blueprintId, duplicate: isDupe }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`? Unhandled event type: ${payload?.type ?? '(none)'}`)
    return new Response(JSON.stringify({ message: 'Event type not handled' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(`✗ Internal error:`, err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
