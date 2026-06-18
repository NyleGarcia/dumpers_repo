import componentMetadata from '../data/component-metadata.json'

interface ComponentMeta {
  itemClass?: string
  grade?: string
}

interface BlueprintSpecInput {
  file?: string
  categoryName?: string
}

const metadataByFile = componentMetadata.blueprints as Record<string, ComponentMeta>

const ITEM_CLASS_LABELS: Record<string, string> = {
  competition: 'Competition',
  civilian: 'Civilian',
  military: 'Military',
  industrial: 'Industrial',
  stealth: 'Stealth',
}

function formatItemClass(itemClass: string): string {
  return ITEM_CLASS_LABELS[itemClass] ?? itemClass.charAt(0).toUpperCase() + itemClass.slice(1)
}

function isShipBlueprint(categoryName?: string): boolean {
  return (
    categoryName?.startsWith('Veh. Comp.') === true ||
    categoryName?.startsWith('Veh. Weapons') === true
  )
}

/** Class + grade subline for ship items only, e.g. "Competition B", "Military A". */
export function formatBlueprintSpecLine(bp: BlueprintSpecInput): string | null {
  if (!bp.file || !isShipBlueprint(bp.categoryName)) return null

  const meta = metadataByFile[bp.file.toLowerCase()]
  if (!meta?.itemClass || !meta?.grade) return null

  return `${formatItemClass(meta.itemClass)} ${meta.grade}`
}
