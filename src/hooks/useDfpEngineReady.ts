import { useSyncExternalStore } from 'react'
import { getDfpEngineSnapshot, subscribeDfpEngineReady } from '../lib/dfpEngine'

/** Re-render when the DFP engine finishes background preload. */
export function useDfpEngineReady(): boolean {
  return useSyncExternalStore(subscribeDfpEngineReady, getDfpEngineSnapshot, () => false)
}
