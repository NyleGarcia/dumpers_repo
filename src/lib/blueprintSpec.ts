import componentMetadata from '../data/component-metadata.json'
import { formatSubtypeLabel, getBlueprintSubType, type BlueprintTaxonomyInput } from './blueprintTaxonomy'

interface ComponentMeta {
  itemClass?: string
  grade?: string
}

export type BlueprintSpecInput = Pick<
  BlueprintTaxonomyInput,
  'file' | 'categoryName' | 'subtype' | 'internalName' | 'blueprintName' | 'subCategoryName' | 'armorWeight' | 'armorSlot'
>

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

/** Class + grade (+ component type) subline for ship items, e.g. "Military A Cooler". */
export function formatBlueprintSpecLine(bp: BlueprintSpecInput): string | null {
  if (!bp.file || !isShipBlueprint(bp.categoryName)) return null

  const subTypeLabel = formatSubtypeLabel(getBlueprintSubType(bp))
  const meta = metadataByFile[bp.file.toLowerCase()]

  if (meta?.itemClass && meta?.grade) {
    const classGrade = `${formatItemClass(meta.itemClass)} ${meta.grade}`
    return subTypeLabel ? `${classGrade} ${subTypeLabel}` : classGrade
  }

  return subTypeLabel
}
