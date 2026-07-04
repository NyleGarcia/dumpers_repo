export type BootstrapStepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error'

export interface BootstrapStep {
  id: string
  label: string
  status: BootstrapStepStatus
  /** 0–100 progress within the active step */
  progress: number
}

export function buildBootstrapSteps(hasUser: boolean): BootstrapStep[] {
  const steps: BootstrapStep[] = [
    { id: 'session', label: 'Establishing uplink', status: 'pending', progress: 0 },
  ]

  if (hasUser) {
    steps.push(
      { id: 'clearance', label: 'Verifying clearance', status: 'pending', progress: 0 },
      { id: 'profile', label: 'Loading crew profile', status: 'pending', progress: 0 },
      { id: 'blueprints', label: 'Syncing blueprint collection', status: 'pending', progress: 0 },
      { id: 'settings', label: 'Loading site configuration', status: 'pending', progress: 0 }
    )
  }

  steps.push({ id: 'dfp', label: 'Initializing DFP pricing engine', status: 'pending', progress: 0 })

  return steps
}

export function computeBootstrapProgress(steps: BootstrapStep[]): number {
  if (steps.length === 0) return 0

  const total = steps.reduce((sum, step) => {
    if (step.status === 'done' || step.status === 'skipped') return sum + 100
    if (step.status === 'active' || step.status === 'error') return sum + step.progress
    return sum
  }, 0)

  return Math.round(total / steps.length)
}

export function patchBootstrapStep(
  steps: BootstrapStep[],
  id: string,
  patch: Partial<Pick<BootstrapStep, 'status' | 'progress'>>
): BootstrapStep[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step))
}
