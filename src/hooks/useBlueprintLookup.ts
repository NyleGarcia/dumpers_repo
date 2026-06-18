import { useMemo } from 'react'
import gameBlueprintsData from '../data/game-blueprints.json'

interface BlueprintLookupEntry {
  internalName: string
  blueprintName: string
  categoryName: string
}

// Build the lookup map once at module load time (data is static)
const blueprintEntries: BlueprintLookupEntry[] = gameBlueprintsData.blueprints.map((bp) => ({
  internalName: bp.internalName,
  blueprintName: bp.blueprintName,
  categoryName: bp.categoryName,
}))

const blueprintByNameMap = new Map<string, BlueprintLookupEntry>()
for (const entry of blueprintEntries) {
  blueprintByNameMap.set(entry.blueprintName.toLowerCase(), entry)
}

export function useBlueprintLookup() {
  // Data is loaded synchronously from the bundled JSON, no async needed
  const byNameMap = useMemo(() => blueprintByNameMap, [])

  return {
    loading: false, // Always loaded since it's bundled

    // Look up a blueprint by the crafted item name (e.g., "Glacier")
    getBlueprintByItemName: (itemName: string): BlueprintLookupEntry | undefined => {
      return byNameMap.get(itemName.toLowerCase())
    },

    // Check if a blueprint exists for an item name
    hasBlueprintForItem: (itemName: string): boolean => {
      return byNameMap.has(itemName.toLowerCase())
    },
  }
}

// Standalone function for quick checks (no hook needed)
export function getBlueprintForItem(itemName: string): BlueprintLookupEntry | undefined {
  return blueprintByNameMap.get(itemName.toLowerCase())
}

export function hasBlueprintForItem(itemName: string): boolean {
  return blueprintByNameMap.has(itemName.toLowerCase())
}
