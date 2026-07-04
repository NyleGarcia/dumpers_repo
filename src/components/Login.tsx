import React, { useEffect, useState } from 'react'
import SiteBrandTitle from './SiteBrandTitle'
import { SITE_COPYRIGHT, SITE_SLOGAN } from '../config/site'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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
      setError('Failed to sign in. Please try again.')
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
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <button
              onClick={handleDiscordLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
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
