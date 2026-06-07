import type { CustomOrder } from './operations'

export type OrderListTab = 'active' | 'completed' | 'archive'

export function isArchivedForUser(order: CustomOrder, userId: string | undefined): boolean {
  if (!userId) return order.status === 'archived'
  if (order.status === 'archived') return true
  if (order.requester_id === userId && order.requester_archived_at) return true
  if (order.assignee_id === userId && order.fulfiller_archived_at) return true
  return false
}

export function isOpenOrder(order: CustomOrder): boolean {
  return ['pending', 'accepted', 'in_progress'].includes(order.status)
}

export function isCompletedStageOrder(order: CustomOrder): boolean {
  return order.status === 'ready_for_pickup' || order.status === 'completed'
}

export function orderMatchesTab(
  order: CustomOrder,
  tab: OrderListTab,
  userId: string | undefined
): boolean {
  if (order.status === 'cancelled') return false

  if (tab === 'archive') {
    return isArchivedForUser(order, userId)
  }

  if (isArchivedForUser(order, userId)) return false

  if (tab === 'active') {
    return isOpenOrder(order)
  }

  return isCompletedStageOrder(order)
}

export function canCustomerArchive(order: CustomOrder, userId: string | undefined): boolean {
  return (
    !!userId &&
    order.requester_id === userId &&
    order.status === 'completed' &&
    !order.requester_archived_at
  )
}

export function canFulfillerArchive(order: CustomOrder, userId: string | undefined): boolean {
  return (
    !!userId &&
    order.assignee_id === userId &&
    order.status === 'completed' &&
    !order.fulfiller_archived_at
  )
}
