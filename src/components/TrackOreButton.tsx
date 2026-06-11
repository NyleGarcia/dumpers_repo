import React from 'react'
import { Link } from '@tanstack/react-router'
import { useMiningTracker } from '../hooks/useMiningTracker'
import { miningTrackerEntryId } from '../lib/localGuestCache'

interface TrackOreButtonProps {
  oreName: string
  rarity: string
  location?: string | null
  compact?: boolean
  showTrackerLink?: boolean
}

export default function TrackOreButton({
  oreName,
  rarity,
  location = null,
  compact = false,
  showTrackerLink = false,
}: TrackOreButtonProps) {
  const { addEntry, removeEntry, isTracked } = useMiningTracker()
  const tracked = isTracked(oreName, location)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tracked) {
      removeEntry(miningTrackerEntryId(oreName, location))
    } else {
      addEntry(oreName, rarity, location)
    }
  }

  const label = tracked
    ? location
      ? 'Tracked here'
      : 'Tracked'
    : location
      ? 'Track here'
      : 'Track ore'

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={tracked ? 'Remove from Mining Tracker' : 'Add to Mining Tracker'}
        className={`p-1 rounded transition-colors ${
          tracked
            ? 'text-orange-400 hover:text-orange-300'
            : 'text-slate-500 hover:text-orange-400'
        }`}
      >
        <svg className="w-4 h-4" fill={tracked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
          tracked
            ? 'bg-orange-950/50 border-orange-500/40 text-orange-300 hover:border-orange-400/60'
            : 'bg-slate-800/60 border-slate-600/50 text-slate-300 hover:border-orange-500/40 hover:text-orange-300'
        }`}
      >
        {label}
      </button>
      {showTrackerLink && (
        <Link
          to="/mining-tracker"
          search={{ ore: oreName, location: location ?? undefined }}
          className="text-xs text-slate-500 hover:text-orange-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Open tracker
        </Link>
      )}
    </div>
  )
}
