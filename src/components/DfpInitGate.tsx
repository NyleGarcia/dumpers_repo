import React from 'react'

/** DFP engine loads during auth bootstrap; this wrapper keeps the provider tree unchanged. */
export default function DfpInitGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
