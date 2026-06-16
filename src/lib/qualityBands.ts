/**
 * Star Citizen 4.8 Quality System
 * 
 * Quality ranges from 1-1000 for all resources.
 * Each resource type has its own unique quality band values (e.g., Iron bands
 * differ from Copper bands). Since we don't have complete band data for all
 * resources, we use a continuous 1-1000 slider.
 * 
 * Example resource-specific bands:
 * - Iron: 325, 521, 664, 710, 874, 907, 970, 1000
 * - Copper: 359, 593, 652, 742, 855, 917, 958, 1000
 * - Titanium: 295, 516, 622, 784, 866, 916, 959, 1000
 */

/**
 * Default quality value for UI components.
 * 500 is the midpoint and a reasonable starting value.
 */
export const DEFAULT_QUALITY_BAND = { value: 500 }

/**
 * Quality tier classification based on approximate ranges
 */
export type QualityTier = 'low' | 'mid' | 'good' | 'high' | 'premium'

export function getQualityTier(quality: number): QualityTier {
  if (quality < 400) return 'low'
  if (quality < 700) return 'mid'
  if (quality < 850) return 'good'
  if (quality < 950) return 'high'
  return 'premium'
}

/**
 * Get CSS color class for a quality tier
 */
export function getQualityTierColor(tier: QualityTier): string {
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
