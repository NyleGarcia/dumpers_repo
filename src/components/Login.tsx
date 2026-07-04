import React, { useEffect, useState } from 'react'
import SiteBrandTitle from './SiteBrandTitle'
import { SITE_COPYRIGHT, SITE_SLOGAN } from '../config/site'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import AuthProviderIcon from './settings/AuthProviderIcon'

export default function Login() {
  const { signInWithGoogle, signInWithDiscord, loading, enterGuestPreview } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [autoApproveEnabled, setAutoApproveEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    const fetchAutoApprove = async () => {
      const { data, error } = await supabase.rpc('get_auto_approve_enabled')
      if (!error && data !== null) {
        setAutoApproveEnabled(data)
      } else {
        setAutoApproveEnabled(false)
      }
    }
    fetchAutoApprove()
  }, [])

  const handleGoogleLogin = async () => {
    try {
      setError(null)
      await signInWithGoogle()
    } catch {
      setError('Failed to sign in with Google. Please try again.')
    }
  }

  const handleDiscordLogin = async () => {
    try {
      setError(null)
      await signInWithDiscord()
    } catch {
      setError('Failed to sign in with Discord. Please try again.')
    }
  }

  return (
    <div className="site-page-bg min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="mb-8">
          <SiteBrandTitle size="hero" layout="stacked" slogan={SITE_SLOGAN} />
        </div>

        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Welcome</h2>
              <p className="text-slate-400 text-sm">
                Sign in with your Google or Discord account to track blueprints and sync across devices.
              </p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AuthProviderIcon provider="google" />
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <button
              onClick={handleDiscordLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AuthProviderIcon provider="discord" />
              {loading ? 'Signing in...' : 'Sign in with Discord'}
            </button>

            {autoApproveEnabled === false && (
              <div className="text-center text-slate-500 text-xs">
                <p>New accounts require approval from an officer.</p>
              </div>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900/80 px-2 text-slate-500">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={enterGuestPreview}
              className="w-full px-6 py-3 rounded-xl border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-800/60 text-sm font-medium transition-all"
            >
              Continue in Offline Mode
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            {SITE_COPYRIGHT}
          </p>
        </div>
      </div>
    </div>
  )
}
