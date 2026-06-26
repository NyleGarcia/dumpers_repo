import type { CustomOrder } from './operations'

export type ListingType = 'wtb' | 'wts'
export type ListingTypeFilter = 'all' | ListingType

export function orderListingType(order: CustomOrder): ListingType {
  return order.listing_type === 'wts' ? 'wts' : 'wtb'
}

export function matchesListingTypeFilter(
  order: CustomOrder,
  filter: ListingTypeFilter
): boolean {
  if (filter === 'all') return true
  return orderListingType(order) === filter
}

/** Buyer: WTB requester or WTS assignee (after accept). */
export function isSemanticBuyer(order: CustomOrder, userId: string): boolean {
  const lt = orderListingType(order)
  return (
    (lt === 'wtb' && order.requester_id === userId) ||
    (lt === 'wts' && order.assignee_id === userId)
  )
}

/** Seller / fulfiller: WTB assignee or WTS requester. */
export function isSemanticSeller(order: CustomOrder, userId: string): boolean {
  const lt = orderListingType(order)
  return (
    (lt === 'wtb' && order.assignee_id === userId) ||
    (lt === 'wts' && order.requester_id === userId)
  )
}

export function listingTypeLabel(type: ListingType): string {
  return type === 'wts' ? 'WTS' : 'WTB'
}

/** Pending WTS listing that allows partial purchases. */
export function isWtsPartialListing(order: CustomOrder): boolean {
  return (
    orderListingType(order) === 'wts' &&
    order.sell_entire_listing === false &&
    !order.source_listing_id
  )
}

/** Child order created from a partial WTS purchase. */
export function isWtsPartialPurchaseOrder(order: CustomOrder): boolean {
  return orderListingType(order) === 'wts' && !!order.source_listing_id
}
