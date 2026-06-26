import React, { useEffect } from 'react'
import { ensureDfpEngine } from '../lib/dfpEngine'

/** Preload DFP engine in the background — never block app shell render. */
export default function DfpInitGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensureDfpEngine().catch((err: unknown) => {
      console.error('DFP engine preload failed:', err)
    })
  }, [])

  return <>{children}</>
}
