/**
 * Standardized ID normalization utilities
 * 
 * PRINCIPLE: All identifiers for storage/lookup should be lowercase.
 * Display names are handled separately and can have proper casing.
 * 
 * Never trust input casing. Never trust stored casing for comparison. Always normalize.
 */

/**
 * Normalize any identifier for storage/lookup
 * Converts to lowercase and trims whitespace
 */
export function normalizeId(value: string): string {
  return value.toLowerCase().trim()
}

/**
 * Normalize for comparison (handles null/undefined safely)
 */
export function safeNormalizeId(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim()
}

/**
 * Compare two identifiers safely (case-insensitive)
 */
export function idsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return safeNormalizeId(a) === safeNormalizeId(b)
}

/**
 * Normalize a slug/key for database storage
 * Converts to lowercase, replaces non-alphanumeric with underscores
 */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Check if a value exists in a record using normalized comparison
 */
export function hasNormalizedKey<T>(
  record: Record<string, T>,
  key: string | null | undefined
): boolean {
  if (!key) return false
  const normalizedKey = safeNormalizeId(key)
  return normalizedKey in record || Object.keys(record).some(k => safeNormalizeId(k) === normalizedKey)
}

/**
 * Get a value from a record using normalized key comparison
 */
export function getNormalized<T>(
  record: Record<string, T>,
  key: string | null | undefined
): T | undefined {
  if (!key) return undefined
  const normalizedKey = safeNormalizeId(key)
  
  // Direct lookup first (fast path)
  if (normalizedKey in record) {
    return record[normalizedKey]
  }
  
  // Fallback to case-insensitive search
  const foundKey = Object.keys(record).find(k => safeNormalizeId(k) === normalizedKey)
  return foundKey ? record[foundKey] : undefined
}
