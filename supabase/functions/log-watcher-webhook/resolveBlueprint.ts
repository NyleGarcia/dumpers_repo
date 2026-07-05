import lookup from './lookup.json' with { type: 'json' }

export interface ResolveContext {
  contractDefinitionId?: string | null
}

export interface ResolveSuccess {
  ok: true
  internalName: string
  blueprintName: string
  resolvedVia: 'internal' | 'display' | 'contract'
}

export interface ResolveFailure {
  ok: false
  error: 'unknown_blueprint' | 'ambiguous_blueprint'
  displayName?: string
  rawInput: string
  candidates?: Array<{
    internalName: string
    blueprintName: string
    categoryName: string | null
  }>
}

export type ResolveResult = ResolveSuccess | ResolveFailure

type LookupData = typeof lookup

function normalizeDisplayKey(value: string): string {
  const val = value.trim().toLowerCase()
  return val.replace(/^(?:civ|ind|mil|ste|com)\/[0-9]\/[a-d]\s+/i, '')
}

/** Extract catalog internalName from bp_craft file paths or return normalized key. */
export function normalizeInternalKey(input: string): string {
  let normalized = input.replace(/\\/g, '/').trim().toLowerCase()
  if (normalized.endsWith(',p')) {
    normalized = normalized.slice(0, -2)
  }
  if (normalized.startsWith('bp_craft_')) {
    normalized = normalized.slice(9)
  }
  if (normalized.endsWith('_scitem.json')) {
    normalized = normalized.slice(0, -12)
  } else if (normalized.endsWith('.json')) {
    normalized = normalized.slice(0, -5)
  } else if (normalized.endsWith('_scitem')) {
    normalized = normalized.slice(0, -7)
  }
  return normalized
}

/**
 * 1. Match catalog internalName (client may send internalName directly).
 * 2. Else map Game.log display text.
 * 3. Else contract-based disambiguation for ambiguous display names.
 */
export function resolveBlueprintInput(
  input: string,
  context: ResolveContext = {},
  data: LookupData = lookup
): ResolveResult {
  const rawInput = input.trim()
  if (!rawInput) {
    return { ok: false, error: 'unknown_blueprint', rawInput }
  }

  const internalKey = normalizeInternalKey(rawInput)
  const byInternal = data.byInternalName as Record<
    string,
    { blueprintName: string; categoryName: string | null }
  >

  if (byInternal[internalKey]) {
    return {
      ok: true,
      internalName: internalKey,
      blueprintName: byInternal[internalKey].blueprintName,
      resolvedVia: 'internal',
    }
  }

  const displayEntry = (data.byDisplayName as Record<string, unknown>)[normalizeDisplayKey(rawInput)]
  if (!displayEntry) {
    return { ok: false, error: 'unknown_blueprint', rawInput }
  }

  if (!('ambiguous' in displayEntry) || !displayEntry.ambiguous) {
    const unique = displayEntry as { internalName: string; blueprintName: string }
    return {
      ok: true,
      internalName: unique.internalName,
      blueprintName: unique.blueprintName,
      resolvedVia: 'display',
    }
  }

  const ambiguous = displayEntry as {
    ambiguous: true
    displayName: string
    candidates: Array<{
      internalName: string
      blueprintName: string
      categoryName: string | null
    }>
  }

  let candidates = ambiguous.candidates
  const prefixMatch = rawInput.match(/^(?:civ|ind|mil|ste|com)\/([0-9])\/[a-d]\s+/i)
  if (prefixMatch) {
    const sizeDigit = prefixMatch[1]
    const filtered = candidates.filter((c) => c.categoryName && c.categoryName.includes('S' + sizeDigit))
    if (filtered.length > 0) candidates = filtered
  }

  const contractKey = context.contractDefinitionId?.trim().toLowerCase()
  if (contractKey) {
    const poolIds = new Set(
      ((data.byContractDefinitionId as Record<string, string[]>)[contractKey] ?? [])
    )
    if (poolIds.size > 0) {
      const filtered = candidates.filter((c) => poolIds.has(c.internalName))
      if (filtered.length > 0) candidates = filtered
    }
  }

  if (candidates.length === 1) {
    return {
      ok: true,
      internalName: candidates[0].internalName,
      blueprintName: candidates[0].blueprintName,
      resolvedVia: contractKey ? 'contract' : 'display',
    }
  }

  return {
    ok: false,
    error: 'ambiguous_blueprint',
    displayName: ambiguous.displayName,
    rawInput,
    candidates,
  }
}
