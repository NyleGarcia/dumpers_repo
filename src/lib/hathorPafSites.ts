/**
 * Hathor Group PAF/OLP Caranite mining sites (Stanton only).
 *
 * Four site families. Each has PAF-I, PAF-II, PAF-III plus one matching OLP.
 *
 * | Site      | Moon     | Spawn key  |
 * |-----------|----------|------------|
 * | Attritus  | Daymar   | Stanton2b  |
 * | Lamina    | Daymar   | Stanton2b  |
 * | Vivere    | Aberdeen | Stanton1b  |
 * | Ruptura   | Aberdeen | Stanton1b  |
 *
 * See scripts/lib/hathorPafSites.mjs for full loc-key reference.
 */

/** The four Hathor platform site names (lowercase). */
export const HATHOR_PAF_SITE_NAMES = ['attritus', 'lamina', 'vivere', 'ruptura'] as const

export type HathorPafSiteName = (typeof HATHOR_PAF_SITE_NAMES)[number]

/** Moons that host Hathor PAF/OLP Caranite operations. */
export const HATHOR_PAF_MOONS = ['daymar', 'aberdeen'] as const

/** Substrings that identify Hathor PAF/OLP contract or pool signals → Stanton. */
export const HATHOR_PAF_OLP_MARKERS = [
  ...HATHOR_PAF_MOONS,
  ...HATHOR_PAF_SITE_NAMES,
  'hathor',
  '_paf',
  '_olp',
  'platform alignment',
  'orbital laser',
] as const

export function isHathorPafOlpSignal(text: string | null | undefined): boolean {
  const lower = String(text || '').toLowerCase()
  return HATHOR_PAF_OLP_MARKERS.some((marker) => lower.includes(marker))
}
