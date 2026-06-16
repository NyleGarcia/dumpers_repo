/**
 * Star Citizen 4.8 Quality Band System
 * 
 * Mining resources now use 8 static quality bands.
 * Each band maps a range of raw quality values to a single representative value.
 */

export interface QualityBand {
  band: number
  minRaw: number
  maxRaw: number
  value: number
  label: string
  tier: 'low' | 'mid' | 'good' | 'high' | 'premium'
}

/**
 * The 8 quality bands used in Star Citizen 4.8+
 * Raw quality ranges are mapped to these fixed band values
 */
export const QUALITY_BANDS: QualityBand[] = [
  { band: 1, minRaw: 0, maxRaw: 399, value: 325, label: 'Q325', tier: 'low' },
  { band: 2, minRaw: 400, maxRaw: 599, value: 521, label: 'Q521', tier: 'low' },
  { band: 3, minRaw: 600, maxRaw: 699, value: 664, label: 'Q664', tier: 'mid' },
  { band: 4, minRaw: 700, maxRaw: 799, value: 710, label: 'Q710', tier: 'mid' },
  { band: 5, minRaw: 800, maxRaw: 899, value: 874, label: 'Q874', tier: 'good' },
  { band: 6, minRaw: 900, maxRaw: 949, value: 907, label: 'Q907', tier: 'high' },
  { band: 7, minRaw: 950, maxRaw: 998, value: 970, label: 'Q970', tier: 'high' },
  { band: 8, minRaw: 999, maxRaw: 1000, value: 1000, label: 'Q1000', tier: 'premium' },
]

/**
 * Get the quality band for a raw quality value
 */
export function getQualityBand(rawQuality: number): QualityBand {
  for (const band of QUALITY_BANDS) {
    if (rawQuality >= band.minRaw && rawQuality <= band.maxRaw) {
      return band
    }
  }
  // Default to lowest band if out of range
  return QUALITY_BANDS[0]
}

/**
 * Get the band value (snapped quality) for a raw quality
 */
export function snapToQualityBand(rawQuality: number): number {
  return getQualityBand(rawQuality).value
}

/**
 * Default quality band for new items (Band 5 - "Good" tier)
 * This is the recommended starting point for crafting
 */
export const DEFAULT_QUALITY_BAND = QUALITY_BANDS[4] // Q874

/**
 * Quality bands suitable for crafting (Band 5+)
 * Bands 1-4 are generally sold or used for low-tier inputs
 */
export const CRAFTING_QUALITY_BANDS = QUALITY_BANDS.filter(b => b.band >= 5)

/**
 * Get CSS color class for a quality band tier
 */
export function getQualityTierColor(tier: QualityBand['tier']): string {
  switch (tier) {
    case 'low':
      return 'text-slate-400'
    case 'mid':
      return 'text-blue-400'
    case 'good':
      return 'text-green-400'
    case 'high':
      return 'text-purple-400'
    case 'premium':
      return 'text-amber-400'
  }
}
