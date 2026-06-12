import type { FeatureId } from './featureAccess'

export interface GuestFeatureCopy {
  title: string
  description: string
  details: string[]
}

/** Shared pitch for guest → member conversion screens */
export const GUEST_MEMBERSHIP_PITCH = {
  headline: 'Member accounts are free',
  subhead: 'Full access to every member tool. No subscriptions. No paid tiers.',
  bullets: [
    'Completely free — sign in with Google',
    'No subscriptions or recurring charges',
    'Full member access once approved (officer review is for community safety, not payment)',
  ],
}

export const GUEST_LOCKED_FEATURE_COPY: Partial<Record<FeatureId, GuestFeatureCopy>> = {
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
}

export function getGuestFeatureCopy(featureId: FeatureId): GuestFeatureCopy {
  return (
    GUEST_LOCKED_FEATURE_COPY[featureId] ?? {
      title: 'Member Feature',
      description: 'Sign in for a free member account with full access to community tools on this site.',
      details: [
        'Free account — no subscriptions or paid tiers',
        'Track your own blueprints, targets, and resources',
        'Participate in orders and fulfillment once approved',
      ],
    }
  )
}
