import { supabase } from './supabase'

const VISITOR_STORAGE_KEY = 'dumpers_visitor_id'
const HEARTBEAT_MS = 60_000
const MAX_PING_SECONDS = 300

const SKIP_PATH_PREFIXES = ['/analytics', '/support-dashboard', '/discord-subscribe']

export type AnalyticsContext = {
  isGuest: boolean
  ghostMode: boolean
}

type ToolSegment = {
  toolId: string
  subToolId: string
}

let context: AnalyticsContext = { isGuest: false, ghostMode: false }
let currentSegment: ToolSegment | null = null
let segmentStartedAt: number | null = null
let pendingMs = 0
let isDocumentVisible = typeof document !== 'undefined'
  ? document.visibilityState !== 'hidden'
  : true
let initialized = false
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function isEnabled(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function shouldTrack(): boolean {
  return isEnabled() && !context.ghostMode
}

export function getAnalyticsVisitorId(): string {
  let id = localStorage.getItem(VISITOR_STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_STORAGE_KEY, id)
  }
  return id
}

function normalizeSubTool(subToolId?: string): string {
  return (subToolId ?? '').trim().slice(0, 64)
}

function pathToTool(pathname: string): string | null {
  if (SKIP_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  switch (pathname) {
    case '/':
      return 'blueprints'
    case '/targets':
      return 'mission_tracker'
    case '/resources':
      return 'resource_tracker'
    case '/mining-tracker':
      return 'mining_tracker'
    case '/orders':
      return 'custom_orders'
    case '/fulfillment':
      return 'fulfillment'
    case '/archive':
      return 'archive'
    case '/guest-locked':
      return 'guest_locked'
    default:
      return null
  }
}

function accumulateVisibleTime() {
  if (!segmentStartedAt) return
  pendingMs += Date.now() - segmentStartedAt
  segmentStartedAt = null
}

function startSegmentTimer() {
  if (!shouldTrack() || !currentSegment || !isDocumentVisible) return
  segmentStartedAt = Date.now()
}

async function flushPendingTime() {
  if (!shouldTrack() || !currentSegment) return

  accumulateVisibleTime()
  const seconds = Math.min(Math.round(pendingMs / 1000), MAX_PING_SECONDS)
  pendingMs = 0

  if (seconds <= 0) return

  try {
    await supabase.rpc('record_analytics_ping', {
      p_visitor_id: getAnalyticsVisitorId(),
      p_tool_id: currentSegment.toolId,
      p_sub_tool_id: currentSegment.subToolId,
      p_active_seconds: seconds,
      p_is_guest: context.isGuest,
    })
  } catch {
    // Analytics must never break the app.
  }
}

function setSegment(toolId: string, subToolId = '') {
  if (!shouldTrack()) return

  const next: ToolSegment = {
    toolId,
    subToolId: normalizeSubTool(subToolId),
  }

  const sameTool =
    currentSegment?.toolId === next.toolId &&
    currentSegment?.subToolId === next.subToolId

  if (sameTool) return

  void flushPendingTime()
  currentSegment = next
  startSegmentTimer()
}

export function trackAnalyticsRoute(pathname: string) {
  const toolId = pathToTool(pathname)
  if (!toolId) {
    void flushPendingTime()
    currentSegment = null
    segmentStartedAt = null
    pendingMs = 0
    return
  }

  setSegment(toolId)
}

export function setAnalyticsSubTool(subToolId: string) {
  if (!currentSegment) return
  setSegment(currentSegment.toolId, subToolId)
}

export function updateAnalyticsContext(next: AnalyticsContext) {
  const wasTracking = shouldTrack()
  context = next
  const nowTracking = shouldTrack()

  if (wasTracking && !nowTracking) {
    void flushPendingTime()
    currentSegment = null
    segmentStartedAt = null
    pendingMs = 0
    return
  }

  if (!wasTracking && nowTracking && currentSegment) {
    startSegmentTimer()
  }
}

function handleVisibilityChange() {
  const visible = document.visibilityState !== 'hidden'
  if (visible === isDocumentVisible) return

  isDocumentVisible = visible

  if (!visible) {
    void flushPendingTime()
    return
  }

  startSegmentTimer()
}

function handlePageHide() {
  void flushPendingTime()
}

export function initAnalytics(getContext: () => AnalyticsContext) {
  if (!isEnabled() || initialized) return
  initialized = true

  const refreshContext = () => updateAnalyticsContext(getContext())
  refreshContext()

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pagehide', handlePageHide)

  heartbeatTimer = setInterval(() => {
    refreshContext()
    void flushPendingTime()
    startSegmentTimer()
  }, HEARTBEAT_MS)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pagehide', handlePageHide)
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
    initialized = false
    void flushPendingTime()
  }
}

export const ANALYTICS_TOOL_LABELS: Record<string, string> = {
  blueprints: 'Blueprints',
  mission_tracker: 'Mission Tracker',
  resource_tracker: 'Resource Tracker',
  mining_tracker: 'Mining Tracker',
  custom_orders: 'Custom Orders',
  fulfillment: 'Fulfillment',
  archive: 'Info Archive',
  guest_locked: 'Guest Locked',
}

export const ANALYTICS_SUB_TOOL_LABELS: Record<string, string> = {
  my_tracker: 'My Tracker',
  browse_missions: 'Browse Missions',
  my_resources: 'My Resources',
  site_total: 'Site Total',
  rs_tracker: 'RS Tracker',
  mining_guide: 'Mining Guide',
  ledger: 'Ledger',
  active: 'Active Orders',
  completed: 'Completed Orders',
  archive: 'Archived Orders',
  welcome: 'Overview',
  components: 'Components',
  ordnance: 'Ordnance',
  factions: 'Factions',
  lore: 'Resource Lore',
  general: 'General Archive',
}

export function formatAnalyticsDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`
}
