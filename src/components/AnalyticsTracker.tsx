import { useEffect, useRef } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { initAnalytics, trackAnalyticsRoute, updateAnalyticsContext } from '../lib/analytics'

export default function AnalyticsTracker() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { user, isGuestPreview, isGhostMode } = useAuth()
  const authRef = useRef({ user, isGuestPreview, isGhostMode })

  authRef.current = { user, isGuestPreview, isGhostMode }

  useEffect(() => {
    return initAnalytics(() => ({
      isGuest: authRef.current.isGuestPreview && !authRef.current.user,
      ghostMode: authRef.current.isGhostMode,
    }))
  }, [])

  useEffect(() => {
    updateAnalyticsContext({
      isGuest: isGuestPreview && !user,
      ghostMode: isGhostMode,
    })
  }, [isGuestPreview, user, isGhostMode])

  useEffect(() => {
    trackAnalyticsRoute(pathname)
  }, [pathname])

  return null
}
