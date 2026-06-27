import React from 'react'
import type { CustomOrder, CustomOrderStatus } from '../lib/operations'
import { displayNameFromFields } from '../lib/supabase'

type CalloutContext = 'wts_seller' | 'wtb_fulfiller'

interface OrderNextStepCalloutProps {
  order: CustomOrder
  context: CalloutContext
}

function buyerName(order: CustomOrder): string {
  return displayNameFromFields(order.assignee)
}

export default function OrderNextStepCallout({ order, context }: OrderNextStepCalloutProps) {
  const message = getMessage(order.status, context, buyerName(order))
  if (!message) return null

  return (
    <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-300 text-xs">
      {message}
    </div>
  )
}

function getMessage(
  status: CustomOrderStatus,
  context: CalloutContext,
  buyer: string
): React.ReactNode | null {
  if (context === 'wts_seller') {
    switch (status) {
      case 'accepted':
        return (
          <>
            A buyer claimed this sale. Optionally start handoff, then mark ready when the item is
            prepared for pickup.
          </>
        )
      case 'in_progress':
        return <>Handoff started. Mark ready when the buyer can pick up in-game.</>
      case 'ready_for_pickup':
        return (
          <>
            Your part is done. Waiting for <strong className="text-cyan-300">{buyer}</strong> to
            confirm pickup in <strong className="text-slate-200">Custom Orders → Active</strong>.
            Nothing else needed here.
          </>
        )
      default:
        return null
    }
  }

  if (context === 'wtb_fulfiller') {
    switch (status) {
      case 'accepted':
        return (
          <>
            Start work when you begin crafting, then complete craft and mark ready when the order is
            prepared for pickup.
          </>
        )
      case 'in_progress':
        return <>Complete craft and mark ready when the order is prepared for pickup.</>
      default:
        return null
    }
  }

  return null
}
