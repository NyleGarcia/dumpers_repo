/**
 * Star Citizen 4.8 Quality Band System
 * 
 * Quality ranges from 1-1000 for all resources.
 * Each resource type has its own unique quality band values.
 * Data sourced from star-citizen.wiki mining location data.
 */

/**
 * Resource-specific quality bands (8 bands per resource)
 * Key is the normalized resource name (lowercase, spaces removed)
 */
export const RESOURCE_QUALITY_BANDS: Record<string, number[]> = {
  // Ores
  'agricium': [346, 588, 667, 796, 852, 943, 971, 1000],
  'aluminum': [318, 511, 614, 783, 896, 919, 953, 1000],
  'copper': [359, 593, 652, 742, 855, 917, 958, 1000],
  'iron': [325, 521, 664, 710, 874, 907, 970, 1000],
  'titanium': [295, 516, 622, 784, 866, 916, 959, 1000],
  'tin': [340, 537, 664, 704, 850, 910, 965, 1000], // Upper bands estimated
  'tungsten': [363, 530, 662, 787, 860, 920, 970, 1000], // Upper bands estimated
  
  // Raw minerals
  'aslarite': [287, 575, 602, 741, 854, 927, 963, 1000],
  'beryl': [324, 547, 677, 717, 860, 937, 955, 1000],
  'corundum': [309, 504, 665, 793, 886, 904, 971, 1000],
  'hephaestanite': [330, 572, 692, 758, 896, 916, 975, 1000],
  'laranite': [298, 510, 698, 707, 858, 910, 975, 1000],
  'ouratite': [310, 523, 647, 779, 860, 912, 960, 1000],
  'quantainium': [344, 514, 669, 762, 852, 901, 974, 1000],
  'quartz': [330, 522, 641, 710, 899, 914, 969, 1000],
  'silicon': [310, 510, 672, 782, 889, 926, 968, 1000],
  'taranite': [310, 525, 646, 718, 853, 925, 957, 1000],
  'ice': [322, 561, 659, 714, 873, 922, 966, 1000],
  
  // Hand mineables (gems)
  'aphorite': [348, 523, 686, 717, 861, 916, 975, 1000],
  'dolivine': [304, 577, 621, 743, 886, 901, 957, 1000],
  'hadanite': [274, 526, 665, 762, 867, 916, 959, 1000],
  'janalite': [269, 596, 632, 732, 898, 926, 964, 1000],
  
  // Vehicle mineables
  'beradom': [287, 578, 656, 723, 881, 937, 969, 1000],
  'feynmaline': [371, 561, 682, 769, 880, 906, 965, 1000],
  'glacosite': [360, 567, 678, 724, 857, 916, 972, 1000],
}

/**
 * Normalize a resource name to match lookup keys
 */
export function normalizeResourceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical suffixes like "(Ore)", "(Raw)"
    .replace(/^raw\s+/i, '') // Remove "Raw " prefix
    .trim()
}

/**
 * Get quality bands for a specific resource
 * Returns undefined if no bands are available for this resource
 */
export function getResourceBands(resourceName: string): number[] | undefined {
  const normalized = normalizeResourceName(resourceName)
  return RESOURCE_QUALITY_BANDS[normalized]
}

/**
 * Check if a resource has known quality bands
 */
export function hasKnownBands(resourceName: string): boolean {
  return getResourceBands(resourceName) !== undefined
}

/**
 * Default quality value for UI components when no bands are known
 */
export const DEFAULT_QUALITY = 500

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

/**
 * Get the band tier (1-8) for a quality value within a resource's bands
 */
export function getBandTier(quality: number, bands: number[]): number {
  for (let i = 0; i < bands.length; i++) {
    if (quality <= bands[i]) return i + 1
  }
  return 8
}
