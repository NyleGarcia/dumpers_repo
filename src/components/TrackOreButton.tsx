import React from 'react'
import { Link } from '@tanstack/react-router'
import { useMiningTracker } from '../hooks/useMiningTracker'
import { miningTrackerEntryId } from '../lib/localGuestCache'

interface TrackOreButtonProps {
  oreName: string
  rarity: string
  compact?: boolean
  showTrackerLink?: boolean
}

export default function TrackOreButton({
  oreName,
  rarity,
  compact = false,
  showTrackerLink = false,
}: TrackOreButtonProps) {
  const { addEntry, removeEntry, isTracked } = useMiningTracker()
  const tracked = isTracked(oreName)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tracked) {
      removeEntry(miningTrackerEntryId(oreName))
    } else {
      addEntry(oreName, rarity)
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={tracked ? 'Remove from Mining Tracker' : 'Add to Mining Tracker'}
        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded transition-colors ${
          tracked
            ? 'bg-orange-600/30 text-orange-300 hover:bg-orange-600/40'
            : 'bg-slate-700/50 text-slate-400 hover:bg-orange-600/20 hover:text-orange-300'
        }`}
      >
        {tracked ? 'Tracked' : 'Track'}
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
        {tracked ? 'Tracked' : 'Track'}
      </button>
      {showTrackerLink && (
        <Link
          to="/mining-tracker"
          search={{ ore: oreName }}
          className="text-xs text-slate-500 hover:text-orange-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Open tracker
        </Link>
      )}
    </div>
  )
}
