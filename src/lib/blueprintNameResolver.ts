import lookupData from '../data/blueprint-name-lookup.json'

export type BlueprintLookupData = typeof lookupData

export interface BlueprintResolveContext {
  contractDefinitionId?: string | null
}

export interface BlueprintResolveSuccess {
  ok: true
  internalName: string
  blueprintName: string
  /** How the input was matched — internal pass-through vs display-name mapping. */
  resolvedVia: 'internal' | 'display' | 'contract'
}

export interface BlueprintResolveFailure {
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

export type BlueprintResolveResult = BlueprintResolveSuccess | BlueprintResolveFailure

function normalizeDisplayKey(value: string): string {
  return value.trim().toLowerCase()
}

/** Extract catalog internalName from bp_craft file paths or return normalized key. */
export function normalizeInternalKey(input: string): string {
  let normalized = input.replace(/\\/g, '/').trim().toLowerCase()
  if (normalized.endsWith(',p')) {
    normalized = normalized.slice(0, -2)
  }
  const scitemMatch = normalized.match(/bp_craft_([^/]+?)_scitem\.json$/i)
  if (scitemMatch) return scitemMatch[1]
  const simpleMatch = normalized.match(/bp_craft_([^/]+?)\.json$/i)
  if (simpleMatch) return simpleMatch[1]
  return normalized
}

/**
 * Resolve webhook/dumper blueprint input.
 * 1. Match catalog internalName (including bp_craft path forms) — pass-through when client sends internalName.
 * 2. Else map Game.log display text via byDisplayName.
 * 3. Else disambiguate ambiguous names with contractDefinitionId when provided.
 */
export function resolveBlueprintInput(
  input: string,
  context: BlueprintResolveContext = {},
  lookup: BlueprintLookupData = lookupData
): BlueprintResolveResult {
  const rawInput = input.trim()
  if (!rawInput) {
    return { ok: false, error: 'unknown_blueprint', rawInput }
  }

  const internalKey = normalizeInternalKey(rawInput)
  const byInternal = lookup.byInternalName as Record<
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

  const displayEntry = (lookup.byDisplayName as Record<string, unknown>)[normalizeDisplayKey(rawInput)]
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
  const contractKey = context.contractDefinitionId?.trim().toLowerCase()
  if (contractKey) {
    const poolIds = new Set(
      ((lookup.byContractDefinitionId as Record<string, string[]>)[contractKey] ?? [])
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
