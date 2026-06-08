import React from 'react'
import {
  AUEC_SINGLE_TRANSFER_MAX,
  formatAuecFull,
} from '../lib/auecTransferLimits'

interface AuecTransferLimitNoticeProps {
  totalAuec: number
  /** customer = placing order; fulfiller = accepting/completing work */
  context: 'customer' | 'fulfiller'
  compact?: boolean
}

export default function AuecTransferLimitNotice({
  totalAuec,
  context,
  compact = false,
}: AuecTransferLimitNoticeProps) {
  if (totalAuec <= AUEC_SINGLE_TRANSFER_MAX) return null

  const partner = context === 'customer' ? 'fulfiller' : 'customer'
  const message = `Over ${formatAuecFull(AUEC_SINGLE_TRANSFER_MAX)} per in-game transfer — agree with your ${partner} on multiple payments before pickup. This app does not handle aUEC.`

  if (compact) {
    return <p className="text-orange-300 text-xs font-medium mt-1">{message}</p>
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-orange-500/50 bg-orange-950/35 px-3 py-2"
    >
      <p className="text-orange-200 text-xs font-semibold uppercase tracking-wide">
        In-game payment over 1M
      </p>
      <p className="text-orange-100/95 text-sm mt-1">{message}</p>
    </div>
  )
}
