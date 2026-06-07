import type { ExtractedBlueprintResource } from '../lib/blueprintResources'

/** Salvage / crafting inputs not always present in blueprint JSON. */
export const EXTRA_CATALOG_RESOURCES: ExtractedBlueprintResource[] = [
  { resourceKey: 'rmc', label: 'RMC (Recycled Material Composite)' },
  { resourceKey: 'construction_material', label: 'Construction Material' },
]

export const EXTRA_CATALOG_RESOURCE_KEYS = new Set(
  EXTRA_CATALOG_RESOURCES.map((r) => r.resourceKey)
)
