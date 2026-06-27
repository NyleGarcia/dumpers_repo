import type { CustomOrder } from './operations'
import { isSemanticBuyer, isSemanticSeller } from './listingType'

export type OrderListTab = 'active' | 'completed' | 'archive'
export type OrderDeadlineRole = 'buyer' | 'seller' | 'fulfiller'

export function orderDeadlineRoleForUser(
  order: CustomOrder,
  userId: string | undefined
): OrderDeadlineRole {
  if (!userId) return 'fulfiller'
  if (isSemanticBuyer(order, userId)) return 'buyer'
  if (order.listing_type === 'wts' && isSemanticSeller(order, userId)) return 'seller'
  return 'fulfiller'
}

export function canUserArchiveOrder(order: CustomOrder, userId: string | undefined): boolean {
  return canCustomerArchive(order, userId) || canFulfillerArchive(order, userId)
}

export function archiveRatingInfo(
  order: CustomOrder,
  userId: string | undefined
): {
  target: 'fulfiller' | 'customer'
  rateeFields: { rsi_handle: string | null; display_name: string | null; email: string | null } | null
  rateeId: string
} | null {
  if (canCustomerArchive(order, userId)) {
    const rateeFields =
      order.listing_type === 'wts' ? order.requester : order.assignee
    const rateeId =
      order.listing_type === 'wts' ? order.requester_id : (order.assignee_id ?? '')
    if (!rateeFields || !rateeId) return null
    return { target: 'fulfiller', rateeFields, rateeId }
  }
  if (canFulfillerArchive(order, userId)) {
    const rateeFields =
      order.listing_type === 'wts' ? order.assignee : order.requester
    const rateeId =
      order.listing_type === 'wts' ? (order.assignee_id ?? '') : order.requester_id
    if (!rateeFields || !rateeId) return null
    return { target: 'customer', rateeFields, rateeId }
  }
  return null
}

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
    return isOpenOrder(order) || order.status === 'ready_for_pickup'
  }

  return isCompletedStageOrder(order)
}

export function canCustomerArchive(order: CustomOrder, userId: string | undefined): boolean {
  if (!userId || order.status !== 'completed' || !isSemanticBuyer(order, userId)) {
    return false
  }
  if (order.listing_type === 'wts') {
    return !order.fulfiller_archived_at
  }
  return !order.requester_archived_at
}

export function canFulfillerArchive(order: CustomOrder, userId: string | undefined): boolean {
  if (!userId || order.status !== 'completed' || !isSemanticSeller(order, userId)) {
    return false
  }
  if (order.listing_type === 'wts') {
    return !order.requester_archived_at
  }
  return !order.fulfiller_archived_at
}

export function canSemanticBuyerConfirmPickup(
  order: CustomOrder,
  userId: string | undefined
): boolean {
  return (
    !!userId &&
    order.status === 'ready_for_pickup' &&
    !order.dispute_opened_at &&
    isSemanticBuyer(order, userId)
  )
}
