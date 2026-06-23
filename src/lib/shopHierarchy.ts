/** Cities / landing zones → parent planet or company body (Stanton). */
export const LOCATION_TO_SITE: Record<string, string> = {
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
}

const GENERIC_SITE_LABELS = new Set(['unknown', 'unmapped', 'rest stops', ''])

/** Use parser-provided site when sensible; infer planet body from city name only as fallback. */
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

  if (locationType === 'refinery') {
    return 'Refineries'
  }

  if (normalizedLocation) {
    return normalizedLocation
  }

  return system || 'Unmapped'
}

/** Skip redundant location tier when it repeats the site (e.g. Levski / Levski). */
export function shouldFlattenLocation(site: string, location: string | null | undefined): boolean {
  if (!location) return true
  return location.toLowerCase() === site.toLowerCase()
}
