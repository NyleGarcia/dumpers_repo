import { supabase } from './supabase'

export interface SiteOrg {
  id: string
  name: string
  slug: string
}

function parseSiteOrg(data: unknown): SiteOrg | null {
  if (!data) return null

  let raw: unknown = data
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.name !== 'string') return null

  return {
    id: row.id,
    name: row.name,
    slug: typeof row.slug === 'string' ? row.slug : 'site',
  }
}

/** Returns the single org for this deployment (one row in organizations). */
export async function fetchSiteOrg(): Promise<SiteOrg | null> {
  const { data, error } = await supabase.rpc('get_site_org')

  if (error) {
    console.error('Error fetching site org:', error)
    return null
  }

  return parseSiteOrg(data)
}
