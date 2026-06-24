import { GUIDE_LOCATION_SYSTEMS } from './miningLocationNames'

export const MINING_RARITY_ORDER = [
  'legendary',
  'epic',
  'rare',
  'uncommon',
  'common',
  'handMineable',
] as const

export const ORE_SIGNATURES: Record<string, number> = {
  Quantainium: 3170,
  Stileron: 3185,
  Savrilium: 3200,
  Ouratite: 3370,
  Riccite: 3385,
  Lindinium: 3400,
  Beryl: 3540,
  Taranite: 3555,
  Borase: 3570,
  Gold: 3585,
  Bexalite: 3600,
  Laranite: 3825,
  Aslarite: 3840,
  Titanium: 3855,
  Tungsten: 3870,
  Agricium: 3885,
  Torite: 3900,
  Hephaestanite: 4180,
  Tin: 4195,
  Quartz: 4210,
  Corundum: 4225,
  Copper: 4240,
  Silicon: 4255,
  Iron: 4270,
  Aluminium: 4285,
  Aluminum: 4285,
  Ice: 4300,
}

/** @deprecated Use getSystemForGuideLocation from miningLocationNames — kept for existing imports. */
export const LOCATION_SYSTEMS: Record<string, string> = GUIDE_LOCATION_SYSTEMS

export const MINING_SYSTEM_COLORS: Record<string, string> = {
  Stanton: 'text-blue-400',
  Pyro: 'text-orange-400',
  Nyx: 'text-purple-400',
}

export const MINING_RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  legendary: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  epic: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  rare: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  uncommon: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  common: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  handMineable: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

export const MINING_RARITY_LABELS: Record<string, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
  handMineable: 'Hand Mineable',
}
