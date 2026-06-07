import React from 'react'
import { formatReputationLabel, type MemberReputation } from '../lib/reputation'

interface ReputationBadgeProps {
  label: string
  reputation: MemberReputation
  className?: string
}

export default function ReputationBadge({ label, reputation, className = '' }: ReputationBadgeProps) {
  const pending = reputation.isPending || reputation.score == null

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
        pending
          ? 'bg-slate-800/80 text-slate-400 border-slate-600'
          : 'bg-amber-950/40 text-amber-200 border-amber-500/30'
      } ${className}`}
      title={
        pending
          ? `Reputation unlocks after ${reputation.completedCount} completed (need 5)`
          : `Average star rating (${reputation.ratingCount} rating${reputation.ratingCount === 1 ? '' : 's'})`
      }
    >
      <span className="text-slate-500">{label}:</span>
      <span className={pending ? 'italic' : 'font-medium'}>{formatReputationLabel(reputation)}</span>
      {!pending && <span className="text-amber-400/80">★</span>}
    </span>
  )
}
