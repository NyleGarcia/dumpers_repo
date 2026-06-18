/**
 * Mission region constants - maps system regions to known locations
 *
 * @deprecated Prefer missionLocations.ts for new code — kept for backward compatibility.
 */

export type { SystemRegionDefinition as SystemRegion } from './missionLocations'
export {
  SYSTEM_REGION_REGISTRY,
  getSystemRegionDefinition as getRegionInfo,
  formatRegionLabel as formatRegion,
  parseRegionCodesFromPoolKey,
} from './missionLocations'

/** @deprecated Use getSystemRegionDefinition from missionLocations */
export function getTerminalLocations(_system: string, _region: string): string[] {
  return []
}
