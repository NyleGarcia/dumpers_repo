import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { DFP_OPT_OUT_NOTICE } from '../../config/site'

/**
 * Single injection point for the DFP opt-out disclaimer.
 * Rendered from AppChrome so every route under Layout (current and future) gets
 * the notice when super-admin disables DFP display — no per-page wiring required.
 */
export default function DfpOptOutFooter() {
  const { dfpDisplayEnabled } = useAuth()

  if (dfpDisplayEnabled) return null

  return (
    <p className="text-xs text-slate-500" data-dfp-opt-out-notice>
      {DFP_OPT_OUT_NOTICE}{' '}
      <a
        href="/archive#dfp"
        target="_blank"
        rel="noopener noreferrer"
        className="text-orange-400/70 hover:text-orange-300 underline"
      >
        Learn more
      </a>
    </p>
  )
}
