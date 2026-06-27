import React, { useState, useEffect } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { getVisibleNavGroups } from '../config/appNav'
import { supabase } from '../lib/supabase'
import Login from './Login'
import BannedAccount from './BannedAccount'
import AdminPanel from './AdminPanel'
import ProfileSettings from './ProfileSettings'
import DbActionsModal from './DbActionsModal'
import DiscordSettingsModal from './DiscordSettingsModal'
import WelcomeModal from './WelcomeModal'
import SupportTicketsModal from './SupportTicketsModal'
import AppChrome from './layout/AppChrome'
import AnalyticsTracker from './AnalyticsTracker'

export default function Layout() {
  const {
    user,
    profile,
    loading,
    isBanned,
    isPending,
    isGhostMode,
    isApproved,
    isOfficerOrAbove,
    signOut,
    displayName,
    canAccess,
    visibilityContext,
    canUseFeature,
    isSuperAdmin,
    isGuestPreview,
    exitGuestPreview,
    signInWithGoogle,
  } = useAuth()
  const [guestSigningIn, setGuestSigningIn] = React.useState(false)
  const navGroups = getVisibleNavGroups(visibilityContext, canAccess)
  const showAdminPanelButton = canUseFeature('admin_panel')
  const showSettingsButton = canUseFeature('settings')
  const showDbActionsButton = isSuperAdmin && !isGhostMode
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [showDbActions, setShowDbActions] = useState(false)
  const [showDiscordSettings, setShowDiscordSettings] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [welcomeChecked, setWelcomeChecked] = useState(false)

  // Welcome onboarding is member+ only — never for guests or pending users
  useEffect(() => {
    if (!user || !isApproved || isGuestPreview || welcomeChecked) return

    const checkWelcome = async () => {
      try {
        const { data } = await supabase.rpc('get_welcome_modal_status')
        if (data) {
          // Show if: always_show is true (super-admin testing) OR user hasn't seen it yet
          const shouldShow = data.always_show || !data.has_seen
          setShowWelcomeModal(shouldShow)
        }
      } catch {
        // If RPC doesn't exist yet (migration not run), skip
      }
      setWelcomeChecked(true)
    }

    checkWelcome()
  }, [user, isApproved, isGuestPreview, welcomeChecked])

  const handleGuestSignIn = async () => {
    setGuestSigningIn(true)
    try {
      await signInWithGoogle()
    } catch {
      setGuestSigningIn(false)
    }
  }

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

  if (!user && !isGuestPreview) {
    return <Login />
  }

  return (
    <>
      <AnalyticsTracker />
      <AppChrome
        navGroups={navGroups}
        displayName={displayName}
        profile={profile}
        isPending={isPending}
        isGuestPreview={isGuestPreview}
        isGhostMode={isGhostMode}
        isOfficerOrAbove={isOfficerOrAbove}
        isSuperAdmin={isSuperAdmin}
        showSettingsButton={showSettingsButton}
        showDbActionsButton={showDbActionsButton}
        showAdminPanelButton={showAdminPanelButton}
        onOpenSettings={() => setShowProfileSettings(true)}
        onOpenDbActions={() => setShowDbActions(true)}
        onOpenDiscord={() => setShowDiscordSettings(true)}
        onOpenAdmin={() => setShowAdminPanel(true)}
        onOpenSupport={() => setShowSupportModal(true)}
        onSignOut={signOut}
        onGuestSignIn={handleGuestSignIn}
        onExitGuestPreview={exitGuestPreview}
        guestSigningIn={guestSigningIn}
      >
        <Outlet />
      </AppChrome>

      {!isGuestPreview && showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
      {!isGuestPreview && showProfileSettings && (
        <ProfileSettings onClose={() => setShowProfileSettings(false)} />
      )}
      {!isGuestPreview && showDbActions && <DbActionsModal onClose={() => setShowDbActions(false)} />}
      {!isGuestPreview && showDiscordSettings && (
        <DiscordSettingsModal onClose={() => setShowDiscordSettings(false)} />
      )}
      {!isGuestPreview && showSupportModal && (
        <SupportTicketsModal onClose={() => setShowSupportModal(false)} />
      )}
      {!isGuestPreview && showWelcomeModal && (
        <WelcomeModal onClose={() => setShowWelcomeModal(false)} />
      )}
    </>
  )
}
