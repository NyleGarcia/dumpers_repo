import React from 'react'
import type { CustomOrder } from '../lib/operations'
import { canUserArchiveOrder } from '../lib/orderArchive'

interface OrderArchiveCalloutProps {
  order: CustomOrder
  userId: string | undefined
  onArchive: () => void
  className?: string
}

export default function OrderArchiveCallout({
  order,
  userId,
  onArchive,
  className = '',
}: OrderArchiveCalloutProps) {
  if (order.status !== 'completed' || !canUserArchiveOrder(order, userId)) {
    return null
  }

  return (
    <div
      className={`p-3 rounded-lg bg-purple-950/40 border border-purple-500/40 space-y-2 ${className}`}
    >
      <p className="text-purple-200 text-xs font-medium">Last step — archive &amp; rate</p>
      <p className="text-purple-200/80 text-xs leading-relaxed">
        Pickup is confirmed. Click <strong className="text-purple-100">Archive &amp; rate</strong>{' '}
        below to score the other party and finish this deal. Both sides must archive and rate before
        you can post or accept new orders.
      </p>
      <button
        type="button"
        onClick={onArchive}
        className="w-full py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm font-medium"
      >
        Archive &amp; rate
      </button>
    </div>
  )
}
