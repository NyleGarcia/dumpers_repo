import React from 'react'

interface GhostModeBannerProps {
  onOpenSettings: () => void
}

export default function GhostModeBanner({ onOpenSettings }: GhostModeBannerProps) {
  return (
    <div className="bg-purple-950/50 border-b border-purple-500/30">
      <div className="site-shell py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
        <p className="text-purple-200/90">
          Ghost Mode is on — you&apos;re hidden from member lists. Personal tools (blueprints, target
          list, resource tracker) still work; orders and community features stay hidden.
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-200/80 hover:text-purple-100 hover:border-purple-400/60 text-xs transition-colors shrink-0 self-start sm:self-auto"
        >
          Privacy settings
        </button>
      </div>
    </div>
  )
}
