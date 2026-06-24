import React from 'react'
import { Link } from '@tanstack/react-router'
import SiteTooltip from './SiteTooltip'
import { useMiningTracker } from '../hooks/useMiningTracker'
import {
  type DepositType,
  miningTrackerEntryId,
  type ProfileMode,
} from '../lib/localGuestCache'
import { getDepositTypes, getLocationProfile } from '../lib/miningClusterProfiles'
import { trackButtonTooltip } from '../lib/miningTooltipContent'

interface TrackOreButtonsProps {
  oreName: string
  rarity: string
  compact?: boolean
  showTrackerLink?: boolean
  profileMode?: ProfileMode
  locationName?: string
  /** When set, show a single track button for this deposit type (By Location). */
  depositType?: DepositType
  /** Called when "Open tracker" is clicked (e.g. close guide modal, switch tab). */
  onOpenTracker?: () => void
  /** Stack buttons vertically (e.g. modal header). */
  stacked?: boolean
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

function TrackButton({
  oreName,
  rarity,
  depositType,
  profileMode = 'overall',
  locationName,
  compact,
  stacked,
  tooltipSide = 'top',
  label,
}: {
  oreName: string
  rarity: string
  depositType: DepositType
  profileMode?: ProfileMode
  locationName?: string
  compact?: boolean
  stacked?: boolean
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  label: string
}) {
  const { addEntry, removeEntry, isTracked } = useMiningTracker()
  const tracked = isTracked(oreName, depositType)
  const id = miningTrackerEntryId(oreName, depositType)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tracked) {
      removeEntry(id)
    } else {
      addEntry(oreName, rarity, {
        depositType,
        profileMode,
        locationName,
      })
    }
  }

  return (
    <SiteTooltip
      content={trackButtonTooltip(oreName, depositType, profileMode, locationName)}
      side={tooltipSide}
      className={stacked ? 'block w-full' : 'inline-flex'}
    >
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? `text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded transition-colors ${
                stacked ? 'w-full ' : ''
              }${
                tracked
                  ? 'bg-orange-600/30 text-orange-300 hover:bg-orange-600/40'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-orange-600/20 hover:text-orange-300'
              }`
            : `text-xs px-2.5 py-1 rounded-md border transition-colors ${
                stacked ? 'w-full ' : ''
              }${
                tracked
                  ? 'bg-orange-950/50 border-orange-500/40 text-orange-300 hover:border-orange-400/60'
                  : 'bg-slate-800/60 border-slate-600/50 text-slate-300 hover:border-orange-500/40 hover:text-orange-300'
              }`
        }
      >
        {tracked ? 'Tracked' : label}
      </button>
    </SiteTooltip>
  )
}

export default function TrackOreButtons({
  oreName,
  rarity,
  compact = false,
  showTrackerLink = false,
  profileMode = 'overall',
  locationName,
  depositType,
  onOpenTracker,
  stacked = false,
  tooltipSide = 'top',
}: TrackOreButtonsProps) {
  const depositTypes = depositType ? [depositType] : getDepositTypes(oreName)
  const groupClass = stacked
    ? 'flex flex-col gap-1.5 w-full sm:w-[10.5rem]'
    : 'flex items-center gap-2 flex-wrap'

  if (depositType && locationName) {
    const resolved = getLocationProfile(oreName, locationName, depositType)
    const type = resolved?.depositType ?? depositType
    return (
      <div className={groupClass}>
        <TrackButton
          oreName={oreName}
          rarity={rarity}
          depositType={type}
          profileMode="location"
          locationName={locationName}
          compact={compact}
          stacked={stacked}
          tooltipSide={tooltipSide}
          label={`Track (${type === 'surface' ? 'Surface' : 'Asteroid'})`}
        />
        {showTrackerLink && (
          <Link
            to="/mining-tracker"
            search={{ view: 'tracker' }}
            className={`text-xs text-slate-500 hover:text-orange-400 transition-colors${stacked ? ' text-center' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onOpenTracker?.()
            }}
          >
            Open tracker
          </Link>
        )}
      </div>
    )
  }

  if (depositTypes.length === 0) return null

  return (
    <div className={groupClass}>
      {depositTypes.includes('surface') && (
        <TrackButton
          oreName={oreName}
          rarity={rarity}
          depositType="surface"
          profileMode={profileMode}
          locationName={locationName}
          compact={compact}
          stacked={stacked}
          tooltipSide={tooltipSide}
          label={compact ? 'Surface' : 'Track Surface'}
        />
      )}
      {depositTypes.includes('asteroid') && (
        <TrackButton
          oreName={oreName}
          rarity={rarity}
          depositType="asteroid"
          profileMode={profileMode}
          locationName={locationName}
          compact={compact}
          stacked={stacked}
          tooltipSide={tooltipSide}
          label={compact ? 'Asteroid' : 'Track Asteroid'}
        />
      )}
      {showTrackerLink && (
        <Link
          to="/mining-tracker"
          search={{ view: 'tracker' }}
          className={`text-xs text-slate-500 hover:text-orange-400 transition-colors${stacked ? ' text-center' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onOpenTracker?.()
          }}
        >
          Open tracker
        </Link>
      )}
    </div>
  )
}

/** @deprecated Use TrackOreButtons */
export function TrackOreButton(props: TrackOreButtonsProps) {
  return <TrackOreButtons {...props} />
}
