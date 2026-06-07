import { useEffect } from 'react'

export type AsyncEffectControls = {
  cancelled: boolean
}

/**
 * Run async work when deps change. In-flight work is cancelled via `controls.cancelled`.
 * Prefer primitive deps (ids, flags) — never objects recreated each render.
 */
export function useAsyncEffect(
  effect: (controls: AsyncEffectControls) => void | Promise<void>,
  deps: readonly unknown[]
): void {
  useEffect(() => {
    const controls: AsyncEffectControls = { cancelled: false }
    void effect(controls)
    return () => {
      controls.cancelled = true
    }
    // Caller owns the dependency list; primitives only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
