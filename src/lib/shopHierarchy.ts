/** Known landing zones / cities → parent body (moon/planet). */
export const LOCATION_TO_SITE: Record<string, string> = {
  Levski: 'Delamar',
  Lorville: 'Hurston',
  'New Babbage': 'microTech',
  Orison: 'Crusader',
  'Area 18': 'ArcCorp',
  'Grim HEX': 'Yela',
  'Port Olisar': 'Crusader',
  'CRU-L1': 'Crusader',
  'HUR-L1': 'Hurston',
  'MIC-L1': 'microTech',
  'ARC-L1': 'ArcCorp',
  Pyro: 'Pyro',
}

const GENERIC_SITE_LABELS = new Set(['unknown', 'unmapped', ''])

/** Prefer body/moon name for tree grouping; never show a bare "Unknown" when we can infer. */
export function resolveTreeSite(
  system: string,
  site: string | null | undefined,
  location: string | null | undefined,
  locationType: string | null | undefined
): string {
  const normalizedSite = (site || '').trim()
  const normalizedLocation = (location || '').trim()

  if (
    normalizedSite &&
    !GENERIC_SITE_LABELS.has(normalizedSite.toLowerCase()) &&
    normalizedSite !== system
  ) {
    return normalizedSite
  }

  if (normalizedLocation && LOCATION_TO_SITE[normalizedLocation]) {
    return LOCATION_TO_SITE[normalizedLocation]
  }

  // Nyx shops orbit Delamar / Levski even when DB site is missing
  if (system === 'Nyx') {
    return 'Delamar'
  }

  // Pyro outposts share the Pyro body
  if (system === 'Pyro') {
    return 'Pyro'
  }

  if (locationType === 'rest_stop') {
    return 'Rest Stops'
  }

  if (locationType === 'refinery') {
    return 'Refineries'
  }

  if (normalizedLocation) {
    return normalizedLocation
  }

  return system || 'Unmapped'
}

/** Skip redundant location tier when it repeats the site (e.g. Pyro / Pyro). */
export function shouldFlattenLocation(site: string, location: string | null | undefined): boolean {
  if (!location) return true
  return location.toLowerCase() === site.toLowerCase()
}
