// Supabase Edge Function: check-rsi-handle-exists
// Read-only check — verifies a handle exists on robertsspaceindustries.com (no DB writes).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RSI_CITIZEN_URL = 'https://robertsspaceindustries.com/en/citizens/'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { handle } = await req.json()
    if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'RSI Handle is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanHandle = handle.trim()
    if (/\s/.test(cleanHandle)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'RSI Handles cannot contain spaces' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rsiUrl = `${RSI_CITIZEN_URL}${encodeURIComponent(cleanHandle)}`
    const rsiResponse = await fetch(rsiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    })

    if (rsiResponse.status === 404) {
      return new Response(
        JSON.stringify({ valid: false, handle: cleanHandle }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!rsiResponse.ok) {
      return new Response(
        JSON.stringify({
          valid: false,
          handle: cleanHandle,
          error: `Unable to verify handle (RSI returned ${rsiResponse.status})`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pageContent = await rsiResponse.text()
    const isValidProfile =
      pageContent.includes('CITIZEN DOSSIER') ||
      pageContent.includes('UEE Citizen Record') ||
      pageContent.includes('Handle name')
    const isNotFound =
      pageContent.includes('404') ||
      pageContent.includes('Page not found') ||
      pageContent.includes('Citizen not found')

    const valid = !isNotFound && isValidProfile

    return new Response(
      JSON.stringify({ valid, handle: cleanHandle }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('check-rsi-handle-exists error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
