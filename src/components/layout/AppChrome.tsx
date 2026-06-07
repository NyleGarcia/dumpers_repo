import React from 'react'
import SiteBrandMark from '../SiteBrandMark'
import SiteBrandTitle from '../SiteBrandTitle'
import { SITE_COPYRIGHT } from '../../config/site'
import type { AppNavItem } from '../../config/appNav'
import type { Profile } from '../../lib/supabase'
import AppNavTabs from './AppNavTabs'
import AppUserMenu from './AppUserMenu'

interface AppChromeProps {
  children: React.ReactNode
  navItems: AppNavItem[]
  displayName: string
  profile: Profile | null
  isPending: boolean
  isGhostMode: boolean
  showSettingsButton: boolean
  showAdminPanelButton: boolean
  onOpenSettings: () => void
  onOpenAdmin: () => void
  onSignOut: () => void
}

export default function AppChrome({
  children,
  navItems,
  displayName,
  profile,
  isPending,
  isGhostMode,
  showSettingsButton,
  showAdminPanelButton,
  onOpenSettings,
  onOpenAdmin,
  onSignOut,
}: AppChromeProps) {
  return (
    <div className="site-page-bg min-h-screen flex flex-col">
      <header className="site-app-header">
        <div className="site-shell flex items-center gap-3 py-2.5">
          <SiteBrandMark size="md" />
          <div className="hidden sm:block border-l border-slate-700/70 pl-3 min-w-0">
            <SiteBrandTitle size="compact" layout="inline" align="left" />
          </div>
          <AppNavTabs items={navItems} className="hidden lg:flex flex-1 justify-center px-2" />
          <AppUserMenu
            displayName={displayName}
            profile={profile}
            isPending={isPending}
            isGhostMode={isGhostMode}
            navItems={navItems}
            showSettingsButton={showSettingsButton}
            showAdminPanelButton={showAdminPanelButton}
            onOpenSettings={onOpenSettings}
            onOpenAdmin={onOpenAdmin}
            onSignOut={onSignOut}
          />
        </div>
        <div className="lg:hidden border-t border-slate-800/70">
          <AppNavTabs items={navItems} className="site-shell py-2 overflow-x-auto" />
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="site-footer site-shell mt-8">
        <p>{SITE_COPYRIGHT}</p>
      </footer>
    </div>
  )
}
