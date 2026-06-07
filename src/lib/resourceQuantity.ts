/** Game-aligned SCU precision for refined materials (up to 3 decimal places). */
export const RESOURCE_QUANTITY_DECIMALS = 3
export const RESOURCE_QUANTITY_STEP = 0.001

export function roundResourceQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** RESOURCE_QUANTITY_DECIMALS
  return Math.round(Math.max(0, value) * factor) / factor
}

export function parseResourceQuantity(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return null
  return roundResourceQuantity(value)
}

/** Display quantity without trailing zeros (max 3 decimals). */
export function formatResourceQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return roundResourceQuantity(value).toFixed(RESOURCE_QUANTITY_DECIMALS).replace(/\.?0+$/, '')
}
