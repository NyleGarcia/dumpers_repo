import React, { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import SiteBrandTitle from '../SiteBrandTitle'
import { SITE_COPYRIGHT } from '../../config/site'
import DfpOptOutFooter from './DfpOptOutFooter'
import type { NavGroup } from '../../config/appNav'
import type { Profile } from '../../lib/supabase'
import AppSidebar from './AppSidebar'
import AppNotificationBell from './AppNotificationBell'
import AppUserMenu from './AppUserMenu'
import GuestPreviewBanner from './GuestPreviewBanner'
import GhostModeBanner from './GhostModeBanner'

interface AppChromeProps {
  children: React.ReactNode
  navGroups: NavGroup[]
  displayName: string
  profile: Profile | null
  isPending: boolean
  isGuestPreview: boolean
  isGhostMode: boolean
  isOfficerOrAbove: boolean
  isSuperAdmin: boolean
  showSettingsButton: boolean
  showDbActionsButton: boolean
  showAdminPanelButton: boolean
  onOpenSettings: () => void
  onOpenDbActions: () => void
  onOpenDiscord: () => void
  onOpenAdmin: () => void
  onOpenSupport: () => void
  onSignOut: () => void
  onGuestSignIn: () => void
  onExitGuestPreview: () => void
  guestSigningIn?: boolean
}

export default function AppChrome({
  children,
  navGroups,
  displayName,
  profile,
  isPending,
  isGuestPreview,
  isGhostMode,
  isOfficerOrAbove,
  isSuperAdmin,
  showSettingsButton,
  showDbActionsButton,
  showAdminPanelButton,
  onOpenSettings,
  onOpenDbActions,
  onOpenDiscord,
  onOpenAdmin,
  onOpenSupport,
  onSignOut,
  onGuestSignIn,
  onExitGuestPreview: _onExitGuestPreview,
  guestSigningIn = false,
}: AppChromeProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="site-page-bg min-h-screen flex flex-col">
      <header className="site-app-header fixed top-0 inset-x-0 z-40 overflow-visible">
        <div className="site-shell h-14 flex items-center gap-2 sm:gap-3 min-w-0">
          <AppSidebar groups={navGroups} />
          <div className="flex items-center min-w-0 flex-1 overflow-hidden">
            <SiteBrandTitle size="compact" layout="inline" align="left" subtle className="truncate" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isGuestPreview ? (
              <button
                type="button"
                onClick={onGuestSignIn}
                disabled={guestSigningIn}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {guestSigningIn ? 'Signing in...' : 'Sign in'}
              </button>
            ) : (
              <>
                <AppNotificationBell disabled={isPending || isGhostMode} />
                <AppUserMenu
                  displayName={displayName}
                  profile={profile}
                  isPending={isPending}
                  isGhostMode={isGhostMode}
                  isOfficerOrAbove={isOfficerOrAbove}
                  isSuperAdmin={isSuperAdmin}
                  showSettingsButton={showSettingsButton}
                  showDbActionsButton={showDbActionsButton}
                  showAdminPanelButton={showAdminPanelButton}
                  onOpenSettings={onOpenSettings}
                  onOpenDbActions={onOpenDbActions}
                  onOpenDiscord={onOpenDiscord}
                  onOpenAdmin={onOpenAdmin}
                  onOpenSupport={onOpenSupport}
                  onSignOut={onSignOut}
                />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="site-header-offset flex-1 flex flex-col">
        {isGuestPreview && <GuestPreviewBanner />}
        {!isGuestPreview && isGhostMode && (
          <GhostModeBanner onOpenSettings={onOpenSettings} />
        )}
        {children}
      </div>

      <footer className="site-footer site-shell mt-8 space-y-1">
        <p>{SITE_COPYRIGHT}</p>
        <p className="text-xs text-slate-600">
          Anonymous usage metrics (tool visits and active time) help improve the site. Ghost Mode sessions are not tracked.
        </p>
        <DfpOptOutFooter />
      </footer>
    </div>
  )
}
