/**
 * Lawful vs illegal mission classification.
 *
 * Use game factionKey (lawful_/unlawful_ prefix) — not display faction name or
 * mission category (e.g. "Bounty Hunter" is a category many lawful factions share).
 *
 * unknown factionKey = generic board / contractor template without unlawful rep binding.
 */

/** Board escort/defend templates (Foxwell, Headhunters reward line, etc.). */
const LAWFUL_BOARD_ESCORT_DEBUG =
  /_(defendentitiesandescort|defenddestructibleentities)_/i

export interface MissionLawfulInput {
  factionKey?: string | null
  factionName?: string | null
  debugName?: string | null
}

export function resolveMissionIsLawful(input: MissionLawfulInput): boolean {
  const factionKey = (input.factionKey || '').toLowerCase()
  const debugName = input.debugName || ''

  if (factionKey.startsWith('unlawful_')) return false
  if (factionKey.startsWith('lawful_')) return true

  // Generator missing rep binding — generic contractor/board work.
  if (factionKey === 'unknown' || factionKey === '') {
    return true
  }

  if (LAWFUL_BOARD_ESCORT_DEBUG.test(debugName)) return true

  // Non-prefixed keys (e.g. wikelo) — default lawful unless explicitly unlawful above.
  return true
}

/** @deprecated Prefer resolveMissionIsLawful with factionKey + debugName. */
export function isUnlawfulFactionName(factionName: string): boolean {
  return !resolveMissionIsLawful({ factionName })
}
