import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type GeoResult = {
  country_code: string | null
  country_name: string | null
  region: string | null
  city: string | null
  timezone: string | null
}

type IpWhoResponse = {
  success?: boolean
  country?: string
  country_code?: string
  region?: string
  city?: string
  timezone?: { id?: string }
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const cfIp = req.headers.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp

  return null
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase()
    return (
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    )
  }

  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true

  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true

  return false
}

async function lookupGeo(ip: string): Promise<GeoResult | null> {
  if (isPrivateIp(ip)) return null

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return null

    const data = (await response.json()) as IpWhoResponse
    if (!data.success || !data.country_code) return null

    return {
      country_code: data.country_code.toUpperCase(),
      country_name: data.country ?? null,
      region: data.region ?? null,
      city: data.city ?? null,
      timezone: data.timezone?.id ?? null,
    }
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    })

    const body = await req.json()
    const visitorId = body?.visitor_id
    const toolId = body?.tool_id
    const subToolId = body?.sub_tool_id ?? ''
    const activeSeconds = body?.active_seconds ?? 0
    const isGuest = body?.is_guest ?? true
    const needsGeo = body?.needs_geo === true

    if (!visitorId || typeof visitorId !== 'string') {
      return new Response(JSON.stringify({ error: 'visitor_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let geo: GeoResult | null = null
    if (needsGeo) {
      const ip = getClientIp(req)
      if (ip) {
        geo = await lookupGeo(ip)
      }
    }

    const { error } = await client.rpc('record_analytics_ping', {
      p_visitor_id: visitorId,
      p_tool_id: toolId,
      p_sub_tool_id: subToolId,
      p_active_seconds: activeSeconds,
      p_is_guest: isGuest,
      p_geo_country_code: geo?.country_code ?? null,
      p_geo_country_name: geo?.country_name ?? null,
      p_geo_region: geo?.region ?? null,
      p_geo_city: geo?.city ?? null,
      p_geo_timezone: geo?.timezone ?? null,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, geo_resolved: !!geo?.country_code }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
