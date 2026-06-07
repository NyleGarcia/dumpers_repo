import React, { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { getVisibleNavItems } from '../config/appNav'
import Login from './Login'
import BannedAccount from './BannedAccount'
import AdminPanel from './AdminPanel'
import ProfileSettings from './ProfileSettings'
import AppChrome from './layout/AppChrome'

export default function Layout() {
  const {
    user,
    profile,
    loading,
    isBanned,
    isPending,
    isGhostMode,
    signOut,
    displayName,
    canAccess,
    visibilityContext,
    canUseFeature,
  } = useAuth()
  const navItems = getVisibleNavItems(visibilityContext, canAccess)
  const showAdminPanelButton = canUseFeature('admin_panel')
  const showSettingsButton = canUseFeature('settings')
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)

  if (loading) {
    return (
      <div className="site-page-bg min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-t-2 border-b-2 border-orange-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-lg font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (isBanned) {
    return <BannedAccount />
  }

  if (!user) {
    return <Login />
  }

  return (
    <>
      <AppChrome
        navItems={navItems}
        displayName={displayName}
        profile={profile}
        isPending={isPending}
        isGhostMode={isGhostMode}
        showSettingsButton={showSettingsButton}
        showAdminPanelButton={showAdminPanelButton}
        onOpenSettings={() => setShowProfileSettings(true)}
        onOpenAdmin={() => setShowAdminPanel(true)}
        onSignOut={signOut}
      >
        <Outlet />
      </AppChrome>

      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
      {showProfileSettings && <ProfileSettings onClose={() => setShowProfileSettings(false)} />}
    </>
  )
}
