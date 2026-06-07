import { redirect } from '@tanstack/react-router'
import type { UserRole } from './supabase'
import { roleAtLeast } from './roles'
import { canUseFeature, type FeatureId, type VisibilityContext } from './featureAccess'

export interface RouterAuthContext {
  loading: boolean
  profile: { role: UserRole } | null
  canAccess: (minRole: UserRole) => boolean
  canAccessPreviewFeatures: boolean
  visibilityContext: VisibilityContext
  canUseFeature: (featureId: FeatureId) => boolean
}

export function requireMinRole(minRole: UserRole) {
  return ({ context }: { context: { auth: RouterAuthContext } }) => {
    if (context.auth.loading) return

    const role = context.auth.profile?.role
    if (!roleAtLeast(role, minRole)) {
      throw redirect({ to: '/' })
    }
  }
}

export function requireFeature(featureId: FeatureId) {
  return ({ context }: { context: { auth: RouterAuthContext } }) => {
    if (context.auth.loading) return

    if (!context.auth.canUseFeature(featureId)) {
      throw redirect({ to: '/' })
    }
  }
}

export function requirePreviewAccess() {
  return requireFeature('preview_features')
}
