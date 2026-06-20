import {
  isSalvageResource,
  isGasResource,
  isHalogenResource,
  isFuelResource,
  isContrabandResource,
  isTradeGoodResource,
  SALVAGE_ORDER_MIN_QUALITY,
  EXTRA_CATALOG_RESOURCE_KEYS,
} from './extraResources'
import { isHarvestResource } from './resourceTypes'

/** Public DFP UX constants only — formula lives in canonical dfp-engine.js */
export const DFP_VERSION = '1.5.1-band-tier-ceil'

/** Banded ores: Purchased Q0 + Band 1 = flat UEX Sell base; Band 2+ = full quality engine. Salvage = UEX Buy (unchanged). */

/** Q0 = store-bought; Q100–Q1000 = mined/refined in 100-point steps. */
export const STOCK_QUALITY_TIERS: readonly number[] = [
  0,
  ...Array.from({ length: 10 }, (_, i) => (i + 1) * 100),
]

export const ORDER_QUALITY_TIERS = STOCK_QUALITY_TIERS
export const DEFAULT_STOCK_QUALITY = 500
export const AMMO_ORDER_MIN_QUALITY = 0

/** Trade commodities without quality tiers (always Q0). */
export function isNoQualityResource(resourceKey: string): boolean {
  return (
    isSalvageResource(resourceKey) ||
    isHarvestResource(resourceKey) ||
    isGasResource(resourceKey) ||
    isHalogenResource(resourceKey) ||
    isFuelResource(resourceKey) ||
    isContrabandResource(resourceKey) ||
    isTradeGoodResource(resourceKey) ||
    EXTRA_CATALOG_RESOURCE_KEYS.has(resourceKey)
  )
}

export function stockQualityTiersForResource(
  resourceKey: string,
  _label?: string
): readonly number[] {
  if (isNoQualityResource(resourceKey)) {
    return [SALVAGE_ORDER_MIN_QUALITY]
  }
  return STOCK_QUALITY_TIERS
}

export function orderMinQualityForResource(
  resourceKey: string,
  _label: string,
  selectedQuality: number
): number {
  if (isNoQualityResource(resourceKey)) {
    return SALVAGE_ORDER_MIN_QUALITY
  }
  return selectedQuality
}
