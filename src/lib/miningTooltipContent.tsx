import React from 'react'
import type { DepositType, LocationSpawnProfile } from './miningClusterProfiles'
import {
  depositTypeLabel,
  depositTypeUpper,
  getDepositTypes,
  getGuideLocationProfiles,
  getLocationProfile,
  getLocationProfilesForOre,
  getOverallProfile,
  getTrackerProfile,
  getTrackerSubtitle,
} from './miningClusterProfiles'
import type { MiningTrackerEntry } from './localGuestCache'
import { formatRsReading } from './miningSignatures'

function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

function compositionSummary(parts: LocationSpawnProfile['compositionParts'] | undefined): string {
  if (!parts?.length) return 'Composition data unavailable'
  return parts
    .slice(0, 3)
    .map((p) => `${p.elementName} ${p.minPercentage}–${p.maxPercentage}%`)
    .join(', ')
}

function clusterPreview(rows: Array<{ nodes: number; chancePercent: number }> | undefined): string {
  if (!rows?.length) return 'Solo only'
  return rows.map((r) => `${pct(r.chancePercent, 0)} (${r.nodes}×)`).join(' / ')
}

export function trackerCardTooltip(entry: MiningTrackerEntry): React.ReactNode {
  const display = getTrackerProfile(entry)
  const locProfiles = getLocationProfilesForOre(entry.oreName).filter(
    (l) => l.depositType === entry.depositType
  )
  const refProfile =
    entry.profileMode === 'location' && entry.locationName
      ? getLocationProfile(entry.oreName, entry.locationName, entry.depositType)
      : locProfiles.sort((a, b) => b.effectiveSpawnPercent - a.effectiveSpawnPercent)[0]

  return (
    <div className="space-y-2">
      <div className="font-semibold text-orange-300">
        {entry.oreName} · {depositTypeUpper(entry.depositType)}
      </div>
      <div className="text-slate-400">{getTrackerSubtitle(entry)}</div>
      {refProfile && (
        <>
          <div>
            Spawn ~{pct(refProfile.effectiveSpawnPercent)} · max {refProfile.maxNodes}× cluster
          </div>
          <div className="text-slate-400">
            Pool {refProfile.relativeSpawnWeight} · group {pct(refProfile.groupSpawnPercent, 1)}
          </div>
          <div>Cluster: {clusterPreview(refProfile.clusterRows)}</div>
          <div className="text-slate-400">Composition: {compositionSummary(refProfile.compositionParts)}</div>
          <div className="text-[10px] font-mono text-slate-500 break-all">{refProfile.hppKey}</div>
        </>
      )}
      {display && (
        <div className="text-slate-400 pt-1 border-t border-slate-700/50">
          Base RS {formatRsReading(display.baseRs)}
        </div>
      )}
    </div>
  )
}

export function trackerChanceTooltip(
  entry: MiningTrackerEntry,
  nodes: number,
  rs: number,
  chancePercent: number
): React.ReactNode {
  return (
    <div className="space-y-1">
      <div className="font-semibold text-orange-300">
        {nodes}× cluster · RS {formatRsReading(rs)}
      </div>
      <div>{pct(chancePercent)} of clustered deposits</div>
      {chancePercent >= 20 && nodes === 2 && (
        <div className="text-slate-400 text-[11px]">
          Remaining solo rocks have no chance row — compare base RS only.
        </div>
      )}
    </div>
  )
}

export function guideOreTitleTooltip(oreName: string): React.ReactNode {
  const types = getDepositTypes(oreName)
  const surfaceCount = getLocationProfilesForOre(oreName).filter((l) => l.depositType === 'surface').length
  const asteroidCount = getLocationProfilesForOre(oreName).filter((l) => l.depositType === 'asteroid').length

  return (
    <div className="space-y-1">
      <div className="font-semibold text-orange-300">{oreName}</div>
      <div>
        Deposit types: {types.map(depositTypeLabel).join(' · ') || 'Unknown'}
      </div>
      <div className="text-slate-400">
        {surfaceCount} surface · {asteroidCount} asteroid mapped locations
      </div>
      <div className="text-slate-400 text-[11px]">Use Track Surface / Track Asteroid for RS Tracker cards.</div>
    </div>
  )
}

export function guideLocationChipTooltip(
  oreName: string,
  guideLocationName: string,
  depositType: DepositType
): React.ReactNode {
  const profile = getLocationProfile(oreName, guideLocationName, depositType)
  if (!profile) {
    return (
      <div>
        <div className="font-semibold">{guideLocationName}</div>
        <div className="text-slate-400">Broad spawn — no HPP mapping for this compendium entry.</div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="font-semibold text-orange-300">
        {depositTypeLabel(depositType)} · {profile.system} System
      </div>
      <div>
        Spawn ~{pct(profile.effectiveSpawnPercent)} · max {profile.maxNodes}× cluster
      </div>
      <div className="text-slate-400">
        Pool {profile.relativeSpawnWeight} · group {pct(profile.groupSpawnPercent, 1)}
      </div>
      <div>Cluster: {clusterPreview(profile.clusterRows)}</div>
      <div className="text-slate-400">Composition: {compositionSummary(profile.compositionParts)}</div>
      <div className="text-slate-500">Preset: {profile.harvestablePreset}</div>
    </div>
  )
}

export function guideOreModalLocationTooltip(
  oreName: string,
  guideLocationName: string,
  depositType: DepositType
): React.ReactNode {
  const profile = getLocationProfile(oreName, guideLocationName, depositType)
  if (!profile) {
    return guideLocationChipTooltip(oreName, guideLocationName, depositType)
  }

  return (
    <div className="space-y-2">
      {guideLocationChipTooltip(oreName, guideLocationName, depositType)}
      {profile.compositionParts.length > 0 && (
        <ul className="text-slate-400 space-y-0.5">
          {profile.compositionParts.map((part) => (
            <li key={part.elementName}>
              {part.elementName}: {part.minPercentage}–{part.maxPercentage}% (Q×{part.qualityScale})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function guideLocationOreTooltip(
  oreName: string,
  locationName: string
): React.ReactNode {
  const profiles = getGuideLocationProfiles(oreName, locationName)
  const profile = profiles[0]
  if (!profile) {
    return (
      <div>
        <div className="font-semibold">{oreName}</div>
        <div className="text-slate-400">No spawn profile mapped for this location.</div>
      </div>
    )
  }

  const overall = getOverallProfile(oreName, profile.depositType)

  return (
    <div className="space-y-1">
      <div className="font-semibold text-orange-300">{oreName}</div>
      <div>{depositTypeLabel(profile.depositType)} at {locationName}</div>
      <div>Spawn ~{pct(profile.effectiveSpawnPercent)}</div>
      <div className="text-slate-400">
        Base RS {overall ? formatRsReading(overall.clusterRows[0]?.rs ? overall.clusterRows[0].rs / overall.clusterRows[0].nodes : 0) : '—'}
      </div>
      <div>Cluster: {clusterPreview(profile.clusterRows)}</div>
    </div>
  )
}

export function trackButtonTooltip(
  oreName: string,
  depositType: DepositType,
  profileMode: 'overall' | 'location',
  locationName?: string
): React.ReactNode {
  return (
    <div className="space-y-1">
      <div className="font-semibold text-orange-300">
        Track {depositTypeLabel(depositType)}
      </div>
      <div>
        Adds {depositTypeLabel(depositType).toLowerCase()} profile to RS Tracker for {oreName}.
      </div>
      {profileMode === 'location' && locationName ? (
        <div className="text-slate-400">Uses spawn/cluster data for {locationName}.</div>
      ) : (
        <div className="text-slate-400">Uses best overall cluster chances for this deposit type.</div>
      )}
    </div>
  )
}
