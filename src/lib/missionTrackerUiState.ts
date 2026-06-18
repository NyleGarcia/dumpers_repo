const STORAGE_KEY = 'dumpers_repo_mission_tracker_ui_v1'

export type MissionTrackerTopView = 'tracker' | 'browse'
export type BrowseViewMode = 'system' | 'faction'
export type BrowseSystem = 'stanton' | 'pyro' | 'nyx' | 'unknown'

export interface BrowseMissionNavState {
  viewMode: BrowseViewMode
  selectedSystem: BrowseSystem | null
  selectedFaction: string | null
  selectedMissionKey: string | null
  searchTerm: string
}

export interface MissionTrackerUiState {
  topView: MissionTrackerTopView
  collapsedBlueprintIds: string[]
  browse: BrowseMissionNavState
}

const DEFAULT_STATE: MissionTrackerUiState = {
  topView: 'tracker',
  collapsedBlueprintIds: [],
  browse: {
    viewMode: 'system',
    selectedSystem: null,
    selectedFaction: null,
    selectedMissionKey: null,
    searchTerm: '',
  },
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function isBrowseSystem(value: unknown): value is BrowseSystem {
  return value === 'stanton' || value === 'pyro' || value === 'nyx' || value === 'unknown'
}

function normalizeBrowseState(raw: unknown): BrowseMissionNavState {
  const browse = (raw && typeof raw === 'object' ? raw : {}) as Partial<BrowseMissionNavState>
  return {
    viewMode: browse.viewMode === 'faction' ? 'faction' : 'system',
    selectedSystem: isBrowseSystem(browse.selectedSystem) ? browse.selectedSystem : null,
    selectedFaction: typeof browse.selectedFaction === 'string' ? browse.selectedFaction : null,
    selectedMissionKey: typeof browse.selectedMissionKey === 'string' ? browse.selectedMissionKey : null,
    searchTerm: typeof browse.searchTerm === 'string' ? browse.searchTerm : '',
  }
}

export function readMissionTrackerUiState(): MissionTrackerUiState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE

  const parsed = safeParse<Partial<MissionTrackerUiState>>(
    localStorage.getItem(STORAGE_KEY),
    DEFAULT_STATE
  )

  return {
    topView: parsed.topView === 'browse' ? 'browse' : 'tracker',
    collapsedBlueprintIds: Array.isArray(parsed.collapsedBlueprintIds)
      ? parsed.collapsedBlueprintIds.filter((id): id is string => typeof id === 'string')
      : [],
    browse: normalizeBrowseState(parsed.browse),
  }
}

export function writeMissionTrackerUiState(
  update: Partial<MissionTrackerUiState> & { browse?: Partial<BrowseMissionNavState> }
): void {
  if (typeof localStorage === 'undefined') return

  const current = readMissionTrackerUiState()
  const next: MissionTrackerUiState = {
    topView: update.topView ?? current.topView,
    collapsedBlueprintIds: update.collapsedBlueprintIds ?? current.collapsedBlueprintIds,
    browse: {
      ...current.browse,
      ...update.browse,
    },
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function makeBrowseMissionKey(mission: {
  poolKey: string
  title: string
  faction: string
  system: string
}): string {
  return `${mission.poolKey}|${mission.title}|${mission.faction}|${mission.system}`
}
