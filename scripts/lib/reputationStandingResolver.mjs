/**
 * Resolve contract standing requirements to the correct reputation scope + tier labels.
 * Contracts may gate on FactionReputationScope (pyro ranks), Security, Hired Muscle, etc.
 */

const STANDING_PATH_CATEGORY_TO_SCOPE = {
  faction_reputation_pyro: 'FactionReputationScope',
  security: 'ReputationScope_Security',
  hiredmuscle: 'ReputationScope_HiredMuscle',
  bounty: 'ReputationScope_Bounty',
  courier: 'ReputationScope_Courier',
  salvage: 'ReputationScope_Salvage',
  guild: 'ReputationScope_Guild',
  assassination: 'ReputationScope_Assassination',
  transport: 'ReputationScope_Transport',
  racing: 'ReputationScope_Racing',
  ship_combat: 'ReputationScope_Ship_Combat',
  fps_combat: 'ReputationScope_FPS_Combat',
  worker: 'ReputationScope_Worker',
  technician: 'ReputationScope_Technician',
  handyman: 'ReputationScope_Handyman',
  smuggling: 'ReputationScope_Smuggling',
  theft: 'ReputationScope_Theft',
  delivery: 'ReputationScope_Delivery',
  emergency: 'ReputationScope_Emergency',
  maintenance: 'ReputationScope_Maintenance',
}

function normalizePath(standingPath) {
  return String(standingPath || '').replace(/\\/g, '/').toLowerCase()
}

function basenameFromPath(filePath) {
  if (!filePath) return null
  const normalized = String(filePath).replace(/\\/g, '/')
  const match = normalized.match(/([^/]+)\.json$/i)
  return match ? match[1].toLowerCase() : null
}

function extractRankSuffix(standingPath) {
  const base = basenameFromPath(standingPath)
  if (!base) return null
  const rankMatch = base.match(/rank(\d+)/i)
  if (rankMatch) return rankMatch[1]
  if (base.includes('noteligible')) return 'noteligible'
  if (base.includes('negativerep') || base.includes('hostile')) return 'negative'
  if (base.includes('allied_border')) return 'allied'
  return null
}

function inferScopeKeyFromStandingPath(standingPath) {
  const normalized = normalizePath(standingPath)
  const categoryMatch = normalized.match(/standings\/([^/]+)\//)
  if (categoryMatch) {
    const category = categoryMatch[1]
    if (STANDING_PATH_CATEGORY_TO_SCOPE[category]) {
      return STANDING_PATH_CATEGORY_TO_SCOPE[category]
    }
  }
  return null
}

function resolveScopeKeyFromRef(scopePath, scopes) {
  if (!scopePath) return null
  const base = basenameFromPath(scopePath)
  if (!base) return null

  const direct = Object.keys(scopes).find((key) => key.toLowerCase() === base)
  if (direct) return direct

  const scopeSuffix = base.replace(/^reputationscope_/, '')
  return (
    Object.keys(scopes).find((key) => {
      const normalized = key.toLowerCase().replace(/^reputationscope_/, '')
      return normalized === scopeSuffix || key.toLowerCase().includes(scopeSuffix)
    }) ?? null
  )
}

export function resolveScopeDisplayName(scopeKey, scopes, localization) {
  if (!scopeKey) return null
  const scope = scopes[scopeKey]
  if (!scope?.displayName) return null

  const raw = scope.displayName
  if (typeof raw === 'string' && raw.startsWith('@')) {
    const key = raw.slice(1)
    return localization[key] || localization[key.toLowerCase()] || key
  }
  return raw
}

/** HiredMuscle scopes mirror Security thresholds; mobiGlas shows Security labels for merc factions. */
export function getPreferredDisplayScopeKey(scopeKey, scopes) {
  if (scopeKey !== 'ReputationScope_HiredMuscle' || !scopes.ReputationScope_Security) {
    return scopeKey
  }

  const hired = scopes.ReputationScope_HiredMuscle?.standings || []
  const security = scopes.ReputationScope_Security?.standings || []
  if (hired.length !== security.length) return scopeKey

  const thresholdsMatch = hired.every(
    (standing, index) => standing.minReputation === security[index]?.minReputation
  )
  return thresholdsMatch ? 'ReputationScope_Security' : scopeKey
}

function findStandingInScope(scope, standingPath, standingsByPath) {
  if (!scope?.standings?.length) return null

  const normalizedTarget = normalizePath(standingPath)
  const targetBase = basenameFromPath(standingPath)

  for (const standing of scope.standings) {
    const standingPathNorm = normalizePath(standing.filePath || '')
    if (normalizedTarget && standingPathNorm.endsWith(normalizedTarget.split('libs/foundry/records/').pop() || '')) {
      return standing
    }
    if (targetBase && basenameFromPath(standing.filePath) === targetBase) {
      return standing
    }
  }

  const rankSuffix = extractRankSuffix(standingPath)
  if (rankSuffix == null) return null

  for (const standing of scope.standings) {
    const standingRank = extractRankSuffix(standing.filePath || standing.name || '')
    if (standingRank === rankSuffix) return standing
  }

  if (standingsByPath && targetBase) {
    for (const [path, standing] of Object.entries(standingsByPath)) {
      if (basenameFromPath(path) === targetBase) return standing
    }
  }

  return null
}

export function resolveStandingForScope(standingPath, scopeKey, reputationSystem, localization) {
  if (!standingPath || !scopeKey) return null

  const { scopes, standingsByPath } = reputationSystem
  const displayScopeKey = getPreferredDisplayScopeKey(scopeKey, scopes)
  const scope = scopes[displayScopeKey] || scopes[scopeKey]
  const standing = findStandingInScope(scope, standingPath, standingsByPath)
  if (!standing) return null

  return {
    name: standing.displayName,
    minReputation: standing.minReputation,
    scopeKey,
    scopeLabel: resolveScopeDisplayName(displayScopeKey, scopes, localization)
      || resolveScopeDisplayName(scopeKey, scopes, localization),
  }
}

export function extractContractReputationPrerequisite(contract) {
  if (contract.minStanding || contract.maxStanding) {
    return {
      minStandingPath: contract.minStanding,
      maxStandingPath: contract.maxStanding,
      scopePath: null,
      factionReputationPath: null,
    }
  }

  for (const prereq of contract.additionalPrerequisites || []) {
    if (prereq?._Type_ !== 'ContractPrerequisite_Reputation' || prereq.exclude) continue
    return {
      minStandingPath: prereq.minStanding,
      maxStandingPath: prereq.maxStanding,
      scopePath: prereq.scope,
      factionReputationPath: prereq.factionReputation,
    }
  }

  return null
}

export function resolveContractStandingRequirement(
  standingPath,
  { scopePath, factionKey } = {},
  reputationSystem,
  localization
) {
  if (!standingPath) return null

  const { scopes } = reputationSystem
  let scopeKey = resolveScopeKeyFromRef(scopePath, scopes)
  if (!scopeKey) {
    scopeKey = inferScopeKeyFromStandingPath(standingPath)
  }

  if (scopeKey) {
    const scoped = resolveStandingForScope(standingPath, scopeKey, reputationSystem, localization)
    if (scoped) return scoped
  }

  // Fallback: raw standing file lookup
  const normalized = normalizePath(standingPath)
  const standing =
    Object.entries(reputationSystem.standingsByPath || {}).find(([path]) =>
      normalized.endsWith(path.replace(/\\/g, '/').toLowerCase())
    )?.[1] ??
    Object.entries(reputationSystem.standingsByPath || {}).find(([path]) =>
      basenameFromPath(path) === basenameFromPath(standingPath)
    )?.[1]

  if (standing) {
    return {
      name: standing.displayName,
      minReputation: standing.minReputation,
      scopeKey: scopeKey ?? null,
      scopeLabel: scopeKey ? resolveScopeDisplayName(scopeKey, scopes, localization) : null,
    }
  }

  return null
}

export function enrichContractStandingFields(contract, reputationSystem, localization) {
  const minStandingPath = contract.__minStandingPath ?? contract.minStanding
  const maxStandingPath = contract.__maxStandingPath ?? contract.maxStanding
  const scopePath = contract.__repScopePath ?? null

  if (
    typeof minStandingPath !== 'string' &&
    typeof maxStandingPath !== 'string' &&
    !scopePath
  ) {
    return { minStanding: null, maxStanding: null, repScopeKey: null, repCareerLabel: null }
  }

  const context = { scopePath, factionKey: contract.factionKey }
  const minStanding = typeof minStandingPath === 'string'
    ? resolveContractStandingRequirement(minStandingPath, context, reputationSystem, localization)
    : null
  const maxStanding = typeof maxStandingPath === 'string'
    ? resolveContractStandingRequirement(maxStandingPath, context, reputationSystem, localization)
    : null

  const repScopeKey = minStanding?.scopeKey ?? maxStanding?.scopeKey ?? null
  const repCareerLabel = minStanding?.scopeLabel ?? maxStanding?.scopeLabel ?? null

  return {
    minStanding: minStanding
      ? { name: minStanding.name, minReputation: minStanding.minReputation }
      : null,
    maxStanding: maxStanding
      ? { name: maxStanding.name, minReputation: maxStanding.minReputation }
      : null,
    repScopeKey,
    repCareerLabel,
  }
}

export function buildFactionContextMap(factions, factionContexts) {
  const byContextFile = {}
  for (const [contextName, context] of Object.entries(factionContexts)) {
    byContextFile[`reputationcontext_${contextName}.json`] = context
    byContextFile[contextName] = context
  }

  const factionToContext = {}
  for (const [factionKey, faction] of Object.entries(factions)) {
    const contextFile = faction.reputationContextFile
    if (!contextFile) continue
    const base = basenameFromPath(contextFile)?.replace(/\.json$/i, '') ?? contextFile
    const contextName = base.replace(/^reputationcontext_/, '')
    factionToContext[factionKey] = factionContexts[contextName] ?? byContextFile[base] ?? null
  }
  return factionToContext
}
