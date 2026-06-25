/**
 * Hathor Group PAF/OLP Caranite mining sites (Stanton only).
 *
 * Four site families. Each has PAF-I, PAF-II, PAF-III plus one matching OLP.
 * Three PAFs align the OLP; firing the laser opens the Caranite mining hole.
 *
 * | Site      | Moon     | Spawn key  | OLP loc key              |
 * |-----------|----------|------------|--------------------------|
 * | Attritus  | Daymar   | Stanton2b  | Stanton2b_OLP_002        |
 * | Lamina    | Daymar   | Stanton2b  | Stanton2b_OLP_001        |
 * | Vivere    | Aberdeen | Stanton1b  | Stanton1b_OLP_002        |
 * | Ruptura   | Aberdeen | Stanton1b  | Stanton1b_OLP_001        |
 *
 * PAF loc keys: Stanton{1b,2b}_Outpost_col_m_drlct_PAF_{cluster}-{1,2,3}
 * Source: extracted-data/Data/Localization/english/global.ini
 */

/** The four Hathor platform site names (lowercase). */
export const HATHOR_PAF_SITE_NAMES = ['attritus', 'lamina', 'vivere', 'ruptura']

/** Moons that host Hathor PAF/OLP Caranite operations. */
export const HATHOR_PAF_MOONS = ['daymar', 'aberdeen']

/** Substrings that identify Hathor PAF/OLP contract or pool signals → Stanton. */
export const HATHOR_PAF_OLP_MARKERS = [
  ...HATHOR_PAF_MOONS,
  ...HATHOR_PAF_SITE_NAMES,
  'hathor',
  '_paf',
  '_olp',
  'platform alignment',
  'orbital laser',
]

/** Build a regex alternation pattern for all Hathor PAF site names. */
export function hathorPafSitePattern() {
  return new RegExp(HATHOR_PAF_SITE_NAMES.join('|'), 'i')
}

/** True when text looks like a Hathor PAF/OLP Stanton location signal. */
export function isHathorPafOlpSignal(text) {
  const lower = String(text || '').toLowerCase()
  return HATHOR_PAF_OLP_MARKERS.some((marker) => lower.includes(marker))
}
