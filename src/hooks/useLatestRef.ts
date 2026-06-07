import { useRef } from 'react'

/** Keep a ref synced to the latest value without adding it to effect deps. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}
