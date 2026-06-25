const BHG_NYX_DIFFICULTY_LABELS: Record<string, string> = {
  rehire: 'Rehire',
  veryeasy: 'Very Easy',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  veryhard: 'Very Hard',
  super: 'Super',
}

const BHG_PAF_DISPLAY_TITLE = 'Verified Bounty · Hathor · Planetary Alignment Facility'

function isUnresolvedDisplayName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true
  const trimmed = name.trim()
  return (
    trimmed.startsWith('@') ||
    trimmed.includes('PLACEHOLDER') ||
    trimmed.includes('UNINITIALIZED')
  )
}

function humanizeContractDebugName(debugName: string | null | undefined): string {
  if (!debugName) return 'Unknown Mission'
  return debugName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase()
      if (lower === 'bhg') return 'BHG'
      if (lower === 'nyx') return 'Nyx'
      if (lower === 'paf') return 'Planetary Alignment Facility'
      if (lower === 'olp') return 'Orbital Laser Platform'
      if (lower === 'asd') return 'ASD'
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function stripMissionTemplatePlaceholders(title: string): string {
  return title
    .replace(/~mission\s*\([^)]*\)/gi, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\s*:\s*(\s|$)/g, ': ')
    .replace(/\s+/g, ' ')
    .replace(/\s+at\s*$/i, '')
    .trim()
}

export interface MissionDisplayTitleInput {
  title?: string | null
  displayTitle?: string | null
  titleKey?: string | null
  debugName?: string | null
}

/** Member-facing mission title for browse cards and tracker rows. */
export function formatMissionDisplayTitle(input: MissionDisplayTitleInput): string {
  if (input.displayTitle?.trim()) {
    return input.displayTitle.trim()
  }

  const title = (input.title || '').replace(/\\n/g, '').replace(/\n/g, '').trim()
  const debugName = input.debugName || ''
  const debugLower = debugName.toLowerCase()
  const titleLower = title.toLowerCase()

  const nyxBhgMatch = debugName.match(/^BountyHuntersGuild_Bounty_Nyx_(.+)$/i)
  if (nyxBhgMatch) {
    const suffixLower = nyxBhgMatch[1].toLowerCase()
    const diffLabel =
      BHG_NYX_DIFFICULTY_LABELS[suffixLower] || humanizeContractDebugName(nyxBhgMatch[1])
    return `Nyx Bounty · ${diffLabel}`
  }

  if (debugLower.includes('asdfacilitydelv')) {
    if (debugLower.includes('researchwing')) return 'Verified Bounty · ASD Research Wing'
    if (debugLower.includes('engineeringwing')) return 'Verified Bounty · ASD Engineering Wing'
    return 'Verified Bounty · ASD Facility'
  }

  if (debugLower.includes('rockcracker') || titleLower.includes('qv breaker station')) {
    if (titleLower.includes('high-risk')) return 'High-Risk Bounty · QV Breaker Station'
    return 'Verified Bounty · QV Breaker Station'
  }

  if (debugLower.includes('bountyhuntersguild_paf') || (debugLower.includes('_paf_') && debugLower.includes('bounty'))) {
    return BHG_PAF_DISPLAY_TITLE
  }

  if (title.includes('~mission')) {
    const cleaned = stripMissionTemplatePlaceholders(title)
    if (cleaned.length > 8 && !/^verified bounty:?$/i.test(cleaned)) {
      return cleaned.replace(/:\s*$/, '').trim()
    }
  }

  if (!title || title === debugName || isUnresolvedDisplayName(title)) {
    return humanizeContractDebugName(debugName)
  }

  return title
}

export function isValidBrowseMissionTitle(title: string | null | undefined): boolean {
  const normalized = (title || '').replace(/\\n/g, '').replace(/\n/g, '').trim()
  if (!normalized) return false
  return (
    !normalized.startsWith('@') &&
    !normalized.includes('UNINITIALIZED') &&
    !normalized.includes('PLACEHOLDER')
  )
}
