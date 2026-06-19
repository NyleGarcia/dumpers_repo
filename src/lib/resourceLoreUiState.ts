const STORAGE_KEY = 'dumpers_repo_resource_lore_ui_v1'

export interface ResourceLoreUiState {
  collapsedCategoryIds: string[]
}

const DEFAULT_STATE: ResourceLoreUiState = {
  collapsedCategoryIds: [],
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function hasResourceLoreUiState(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function readResourceLoreUiState(): ResourceLoreUiState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE

  const parsed = safeParse<Partial<ResourceLoreUiState>>(
    localStorage.getItem(STORAGE_KEY),
    DEFAULT_STATE
  )

  return {
    collapsedCategoryIds: Array.isArray(parsed.collapsedCategoryIds)
      ? parsed.collapsedCategoryIds.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

export function writeResourceLoreUiState(update: Partial<ResourceLoreUiState>): void {
  if (typeof localStorage === 'undefined') return

  const current = readResourceLoreUiState()
  const next: ResourceLoreUiState = {
    collapsedCategoryIds: update.collapsedCategoryIds ?? current.collapsedCategoryIds,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
