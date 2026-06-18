const STORAGE_KEY = 'dumpers_repo_mission_tracker_ui_v1'

export type MissionTrackerTopView = 'tracker' | 'browse'
export type BrowseSystem = 'stanton' | 'pyro' | 'nyx' | 'unknown'

export interface BrowseMissionNavState {
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

export function readMissionTrackerUiState(): MissionTrackerUiState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE

  const parsed = safeParse<Partial<MissionTrackerUiState>>(
    localStorage.getItem(STORAGE_KEY),
    DEFAULT_STATE
  )

  const browse = (parsed.browse && typeof parsed.browse === 'object' ? parsed.browse : {}) as Partial<BrowseMissionNavState>

  return {
    topView: parsed.topView === 'browse' ? 'browse' : 'tracker',
    collapsedBlueprintIds: Array.isArray(parsed.collapsedBlueprintIds)
      ? parsed.collapsedBlueprintIds.filter((id): id is string => typeof id === 'string')
      : [],
    browse: {
      selectedFaction: typeof browse.selectedFaction === 'string' ? browse.selectedFaction : null,
      selectedMissionKey: typeof browse.selectedMissionKey === 'string' ? browse.selectedMissionKey : null,
      searchTerm: typeof browse.searchTerm === 'string' ? browse.searchTerm : '',
    },
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

export function makeBrowseMissionKey(mission: { entryKey: string }): string {
  return mission.entryKey
}
