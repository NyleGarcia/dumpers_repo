import commodityBases from '../data/dfp-commodity-bases.json'

export interface DfpResourceIdentity {
  internalName: string
  displayName: string
  uexName: string
}

interface CommodityBaseEntry {
  internalName: string
  displayName: string
  uexName: string
  basePerScu: number
}

const catalogByInternal = new Map<string, DfpResourceIdentity>()
const catalogByDisplay = new Map<string, DfpResourceIdentity>()
const catalogByUex = new Map<string, DfpResourceIdentity>()

const resources = commodityBases.resources as Record<string, CommodityBaseEntry>

for (const entry of Object.values(resources ?? {})) {
  const identity: DfpResourceIdentity = {
    internalName: entry.internalName,
    displayName: entry.displayName,
    uexName: entry.uexName,
  }
  catalogByInternal.set(entry.internalName, identity)
  catalogByDisplay.set(entry.displayName, identity)
  catalogByUex.set(entry.uexName, identity)
}

/** Look up Resource Tracker Q0 identity (internal / display / UEX names). */
export function lookupDfpResourceIdentity(
  nameOrKey: string | undefined
): DfpResourceIdentity | undefined {
  if (!nameOrKey) return undefined
  return (
    catalogByInternal.get(nameOrKey) ??
    catalogByDisplay.get(nameOrKey) ??
    catalogByUex.get(nameOrKey)
  )
}

/**
 * Preferred name to pass to the DFP engine — any of internalName, displayName, or uexName resolves.
 * Prefers displayName for human-readable order lines; falls back to label then key.
 */
export function dfpEngineResourceName(resourceKey: string, label?: string): string {
  const identity = catalogByInternal.get(resourceKey)
  if (identity) return identity.displayName
  return label?.trim() || resourceKey
}
