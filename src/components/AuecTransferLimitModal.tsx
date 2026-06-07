import React, { useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import {
  AUEC_DAILY_TRANSFER_COUNT_MAX,
  AUEC_SINGLE_TRANSFER_MAX,
  formatAuecFull,
} from '../lib/auecTransferLimits'
import { formatDfpRequiredPrice } from '../lib/dfp'

interface AuecTransferLimitModalProps {
  totalAuec: number
  onConfirm: () => void
  onCancel: () => void
  confirming?: boolean
}

export default function AuecTransferLimitModal({
  totalAuec,
  onConfirm,
  onCancel,
  confirming = false,
}: AuecTransferLimitModalProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  useBodyScrollLock(true)

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 overflow-hidden"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auec-transfer-limit-title"
    >
      <div
        className="bg-slate-900 border-2 border-orange-500/50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div>
            <p
              id="auec-transfer-limit-title"
              className="text-orange-200 font-bold text-base uppercase tracking-wide"
            >
              In-game payment required
            </p>
            <p className="text-white text-sm mt-2">
              This order total is <strong>{formatDfpRequiredPrice(totalAuec)}</strong>, which is
              more than the commonly reported per-transfer cap in Star Citizen.
            </p>
          </div>

          <div className="text-sm text-slate-300 space-y-2">
            <p>
              <strong className="text-slate-200">As commonly reported in-game today</strong>{' '}
              (limits may change):
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Up to {formatAuecFull(AUEC_SINGLE_TRANSFER_MAX)} per transfer.</li>
              <li>Up to {AUEC_DAILY_TRANSFER_COUNT_MAX} transfers per day per player.</li>
            </ul>
            <p className="text-slate-400 text-xs">
              It is unclear whether the daily cap means five separate payments or up to five million
              aUEC total. Verify current rules in-game — this app does not track or send aUEC.
            </p>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-orange-950/30 border border-orange-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 shrink-0"
            />
            <span className="text-sm text-orange-50 leading-relaxed">
              I understand that exceeding the current game limits on currency transfer means that it
              is up to the <strong>Customer</strong> and <strong>Fulfiller</strong> to come to
              agreements on when and how payment is split across in-game transfers.
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-sm font-medium border border-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!acknowledged || confirming}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              {confirming ? 'Submitting...' : 'Submit order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
