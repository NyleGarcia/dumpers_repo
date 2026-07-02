import React from 'react'
import { formatDfpAuec } from '../lib/dfp'

interface WtsListPriceSliderProps {
  value: number
  maxPct: number
  baseAuec: number
  adjustedAuec: number
  onChange: (pct: number) => void
  label?: string
  compact?: boolean
}

export default function WtsListPriceSlider({
  value,
  maxPct,
  baseAuec,
  adjustedAuec,
  onChange,
  label = 'List price',
  compact = false,
}: WtsListPriceSliderProps) {
  const formatPct = (pct: number) => (pct > 0 ? `+${pct}%` : `${pct}%`)

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="text-cyan-300/90">{label}</span>
        <span className="font-mono tabular-nums text-cyan-200">{formatPct(value)}</span>
      </div>
      <input
        type="range"
        min={-maxPct}
        max={maxPct}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        aria-label={`${label} adjustment`}
      />
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>{formatPct(-maxPct)}</span>
        <span>DFP</span>
        <span>{formatPct(maxPct)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
        <span className="text-slate-500">
          Base {formatDfpAuec(baseAuec)}
        </span>
        <span className="text-slate-600">→</span>
        <span className="text-cyan-200 font-medium tabular-nums">
          List {formatDfpAuec(adjustedAuec)}
        </span>
      </div>
    </div>
  )
}
