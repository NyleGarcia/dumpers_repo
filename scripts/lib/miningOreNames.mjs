/**
 * Canonical ore names and hand-mineable classification for mining location parsing.
 * Hand-mineables are excluded from the ship RS Tracker reference (FPS gems + select ground-vehicle gems).
 */

/** Compendium / desc typos → canonical in-game name. */
export const ORE_COMPENDIUM_ALIASES = {
  Beradon: 'Beradom',
}

/** Spawn keys → preferred compendium / guide location label. */
export const SPAWN_KEY_PREFERRED_GUIDE_NAME = {
  Pyro2: 'Monox',
}

export const HAND_MINEABLE_ORES = new Set([
  'Aphorite',
  'Dolivine',
  'Hadanite',
  'Janalite',
  'Glacosite',
  'Feynmaline',
  'Sadaryx',
])

export function normalizeCompendiumOreName(name) {
  const trimmed = String(name || '').trim()
  return ORE_COMPENDIUM_ALIASES[trimmed] ?? trimmed
}

/** Strip trailing parenthetical from desc mineable lines, e.g. "Janalite (Caves only)". */
export function stripMineableLabel(raw) {
  return String(raw || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
}

export function normalizeMineableLabel(raw) {
  return normalizeCompendiumOreName(stripMineableLabel(raw))
}

export function isHandMineableOre(name) {
  return HAND_MINEABLE_ORES.has(normalizeCompendiumOreName(name))
}

export function preferredGuideNameForSpawnKey(spawnKey, fallback) {
  return SPAWN_KEY_PREFERRED_GUIDE_NAME[spawnKey] ?? fallback
}
