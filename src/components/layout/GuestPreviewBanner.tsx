import React from 'react'

interface GuestPreviewBannerProps {
  onSignIn: () => void
  onExit: () => void
  signingIn?: boolean
}

export default function GuestPreviewBanner({
  onSignIn,
  onExit,
  signingIn = false,
}: GuestPreviewBannerProps) {
  return (
    <div className="bg-amber-950/60 border-b border-amber-500/30">
      <div className="site-shell py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
        <p className="text-amber-200/90">
          You&apos;re browsing as a guest. Sign in to track blueprints, place orders, and join the
          community.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSignIn}
            disabled={signingIn}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            {signingIn ? 'Signing in...' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-200/80 hover:text-amber-100 hover:border-amber-400/60 text-xs transition-colors"
          >
            Exit preview
          </button>
        </div>
      </div>
    </div>
  )
}
