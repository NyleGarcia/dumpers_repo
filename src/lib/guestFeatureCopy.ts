import type { FeatureId } from './featureAccess'

export interface GuestFeatureCopy {
  title: string
  description: string
  details: string[]
}

export const GUEST_LOCKED_FEATURE_COPY: Partial<Record<FeatureId, GuestFeatureCopy>> = {
  target_bp_list: {
    title: 'Target BP List',
    description: 'Your personal wishlist of blueprints you\'re working towards unlocking.',
    details: [
      'Add blueprints from the Blueprints page to your target list',
      'See which faction contracts reward your target blueprints',
      'Track progress toward required reputation levels',
      'Remove blueprints once you\'ve acquired them',
    ],
  },
  resource_tracker: {
    title: 'Resource Tracker',
    description: 'Track your personal inventory of mined and refined resources.',
    details: [
      'Log quantities and quality levels of resources you\'ve collected',
      'See Dumper\'s Fair-Value Price (DFP) values for your stockpile',
      'Sync resource types automatically from the blueprint catalog',
    ],
  },
  custom_orders: {
    title: 'Custom Orders',
    description: 'Create and manage custom crafting orders with other members.',
    details: [
      'Request crafted items with blueprint, quality, and quantity requirements',
      'Get notified when a fulfiller accepts your order',
      'Rate fulfillers when orders complete — builds community reputation',
      'Requires a verified RSI Handle and officer approval to participate',
    ],
  },
  fulfillment: {
    title: 'Fulfillment',
    description: 'View and fulfill pending custom orders from other members.',
    details: [
      'Browse open orders and accept ones you can craft',
      'Mark orders ready for pickup when work is done',
      'Earn fair DFP-based pricing and build fulfiller reputation',
      'Requires a verified RSI Handle and officer approval to participate',
    ],
  },
}

export function getGuestFeatureCopy(featureId: FeatureId): GuestFeatureCopy {
  return (
    GUEST_LOCKED_FEATURE_COPY[featureId] ?? {
      title: 'Member Feature',
      description: 'Sign in and get approved to access community tools on this site.',
      details: ['Track your own blueprints and collections', 'Participate in orders and fulfillment'],
    }
  )
}
