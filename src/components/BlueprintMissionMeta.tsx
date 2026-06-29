import { formatBlueprintDropChance } from '../lib/missionAcquisition'

interface BlueprintMissionMetaProps {
  isAcquired: boolean
  isTracked: boolean
  dropChance?: number | null
}

export default function BlueprintMissionMeta({
  isAcquired,
  isTracked,
  dropChance,
}: BlueprintMissionMetaProps) {
  const dropLabel = !isAcquired ? formatBlueprintDropChance(dropChance) : null
  const hasMeta = isAcquired || (isTracked && !isAcquired) || dropLabel

  if (!hasMeta) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
      {isAcquired && (
        <span className="text-[10px] text-green-500">Acquired</span>
      )}
      {isTracked && !isAcquired && (
        <span className="text-[10px] text-amber-400">On tracker</span>
      )}
      {dropLabel && (
        <span className="text-[10px] text-amber-400/80">{dropLabel}</span>
      )}
    </div>
  )
}
