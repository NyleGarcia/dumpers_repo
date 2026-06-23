import gameComponentsData from '../data/game-components.json'
import type { ComponentData } from '../hooks/useArchiveData'

interface RawComponent {
  id?: string
  name: string
  type: string
  displayName?: string
  size?: number
  grade?: number
  manufacturerCode?: string | null
  manufacturer?: string | null
}

export function isUnresolvedComponentName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true
  const trimmed = name.trim()
  return (
    trimmed.startsWith('@') ||
    trimmed.includes('PLACEHOLDER') ||
    trimmed.includes('UNINITIALIZED')
  )
}

function gradeLetter(grade: number | undefined): string {
  const rank = Math.max(0, Math.min(3, grade ?? 0))
  return String.fromCharCode(65 + rank)
}

export function buildComponentCatalog(): ComponentData[] {
  const raw = (gameComponentsData as { components?: RawComponent[] }).components ?? []

  return raw
    .filter((c) => c.name && !isUnresolvedComponentName(c.displayName))
    .map((c, index) => ({
      id: index + 1,
      internal_id: c.name,
      display_name: c.displayName || c.name,
      component_type: c.type,
      type_code: (c.type || 'unkn').substring(0, 4).toUpperCase(),
      manufacturer: c.manufacturer || 'Unknown',
      manufacturer_code: c.manufacturerCode || 'UNKN',
      size: c.size ?? 0,
      class: 'Standard',
      class_code: 'STD',
      grade: gradeLetter(c.grade),
      grade_rank: (c.grade ?? 0) + 1,
      full_label: c.displayName || c.name,
    }))
    .sort((a, b) => {
      if (a.component_type !== b.component_type) {
        return a.component_type.localeCompare(b.component_type)
      }
      return a.display_name.localeCompare(b.display_name)
    })
}

export const bundledComponentCatalog = buildComponentCatalog()
