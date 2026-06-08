import React, { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import type { AppNavItem } from '../../config/appNav'
import type { Profile } from '../../lib/supabase'

interface AppUserMenuProps {
  displayName: string
  profile: Profile | null
  isPending: boolean
  isGhostMode: boolean
  navItems: AppNavItem[]
  showSettingsButton: boolean
  showDbActionsButton: boolean
  showAdminPanelButton: boolean
  onOpenSettings: () => void
  onOpenDbActions: () => void
  onOpenAdmin: () => void
  onSignOut: () => void
}

export default function AppUserMenu({
  displayName,
  profile,
  isPending,
  isGhostMode,
  navItems,
  showSettingsButton,
  showDbActionsButton,
  showAdminPanelButton,
  onOpenSettings,
  onOpenDbActions,
  onOpenAdmin,
  onSignOut,
}: AppUserMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const close = () => setOpen(false)

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-950/80 border border-amber-500/50 rounded-lg">
          <div className="w-6 h-6 rounded-full bg-amber-600/30 border border-amber-500/50 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Pending</span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }

  const triggerClass = isGhostMode
    ? 'bg-purple-950/80 border-purple-500/60 hover:bg-purple-900/80'
    : 'bg-slate-800/90 border-slate-600 hover:bg-slate-700'

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-1 backdrop-blur border rounded-lg transition-colors shadow-md ${triggerClass}`}
      >
        {isGhostMode ? (
          <div className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </div>
        ) : profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} className="w-6 h-6 rounded-full" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        <span
          className={`text-xs hidden sm:inline max-w-[100px] truncate ${
            isGhostMode ? 'text-purple-300 font-semibold uppercase tracking-wide' : 'text-white'
          }`}
        >
          {isGhostMode ? 'Ghost' : displayName}
        </span>
        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={close} />
          <div
            className={`absolute right-0 top-full mt-2 w-56 bg-slate-800 rounded-xl shadow-xl z-[60] overflow-hidden ${
              isGhostMode ? 'border border-purple-500/30' : 'border border-slate-700'
            }`}
          >
            <div className="p-3 border-b border-slate-700">
              <p className="text-white font-medium truncate">{displayName}</p>
              {isGhostMode ? (
                <p className="text-purple-300/80 text-xs mt-1">Hidden from member lists. Personal tracking only.</p>
              ) : (
                <>
                  {profile?.rsi_handle && (
                    <p className="text-slate-500 text-xs truncate">({profile.display_name})</p>
                  )}
                  <p className="text-slate-400 text-sm truncate">{profile?.email}</p>
                  <p className="text-xs mt-1">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        profile?.role === 'super-admin'
                          ? 'bg-purple-900/50 text-purple-400'
                          : profile?.role === 'officer'
                            ? 'bg-blue-900/50 text-blue-400'
                            : 'bg-green-900/50 text-green-400'
                      }`}
                    >
                      {profile?.role === 'super-admin'
                        ? 'Super Admin'
                        : profile?.role === 'officer'
                          ? 'Officer'
                          : 'Member'}
                    </span>
                  </p>
                </>
              )}
            </div>

            <div className="lg:hidden">
              {navItems.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Navigation
                  </div>
                  {navItems.map((item) => (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={close}
                      className={`w-full px-4 py-2 text-left transition-colors flex items-center justify-between gap-2 ${
                        pathname === item.path ? 'bg-orange-950/40 text-orange-200' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  <div className="border-t border-slate-700" />
                </>
              )}
            </div>

            {showSettingsButton && (
              <button
                type="button"
                onClick={() => {
                  close()
                  onOpenSettings()
                }}
                className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Settings
              </button>
            )}

            {showDbActionsButton && (
              <button
                type="button"
                onClick={() => {
                  close()
                  onOpenDbActions()
                }}
                className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 transition-colors"
              >
                DB Actions
              </button>
            )}

            {showAdminPanelButton && (
              <button
                type="button"
                onClick={() => {
                  close()
                  onOpenAdmin()
                }}
                className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Admin Panel
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                close()
                onSignOut()
              }}
              className="w-full px-4 py-2 text-left text-red-400 hover:bg-slate-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
