import { ORE_SIGNATURES } from './miningConstants'

/** FPS gems + ground-vehicle gems with no ship RS signature. */
export const HAND_MINEABLE_ORES = new Set([
  'Aphorite',
  'Dolivine',
  'Hadanite',
  'Janalite',
  'Glacosite',
  'Feynmaline',
  'Sadaryx',
])

/** Ground-vehicle gems (no ship RS, not FPS hand-mineable). */
export const GROUND_VEHICLE_GEMS = new Set(['Beradom', 'Glacosite', 'Feynmaline'])

const ORE_COMPENDIUM_ALIASES: Record<string, string> = {
  Beradon: 'Beradom',
}

export function normalizeMiningOreName(name: string): string {
  const trimmed = name.trim()
  return ORE_COMPENDIUM_ALIASES[trimmed] ?? trimmed
}

export function isHandMineableOre(name: string): boolean {
  return HAND_MINEABLE_ORES.has(normalizeMiningOreName(name))
}

export function isHandMineableRarity(rarity: string | undefined): boolean {
  return rarity === 'handMineable'
}

export function hasShipRsSignature(oreName: string): boolean {
  return normalizeMiningOreName(oreName) in ORE_SIGNATURES
}

/** Guide chips for ores without RS spawn profiles (hand-mineables, ground gems, etc.). */
export function isGuideLocationListOnlyOre(oreName: string, rarity: string): boolean {
  return isHandMineableOre(oreName) || isHandMineableRarity(rarity) || !hasShipRsSignature(oreName)
}

export function getGuideLocationSpawnLabel(oreName: string): string {
  const name = normalizeMiningOreName(oreName)
  if (isHandMineableOre(name)) return 'Hand-mineable'
  if (GROUND_VEHICLE_GEMS.has(name)) return 'Ground vehicle'
  return 'Compendium'
}
