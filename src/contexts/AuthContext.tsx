import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase, Profile, getDisplayName, type UserRole } from '../lib/supabase'
import { roleAtLeast } from '../lib/roles'
import {
  buildVisibilityContext,
  canUseFeature,
  type FeatureId,
  type VisibilityContext,
} from '../lib/featureAccess'
import { readGuestPreviewSession, writeGuestPreviewSession } from '../lib/guestPreview'
import { normalizeGuestBlueprintId } from '../lib/guestCatalog'
import {
  ensureGuestCacheSchema,
  readGuestAcquiredBlueprints,
  readGuestGroupBlueprintVariants,
  writeGuestAcquiredBlueprints,
  writeGuestGroupBlueprintVariants,
} from '../lib/localGuestCache'
import { maybeMigrateOfflineData } from '../lib/offlineMigration'
import { fetchOrgLogoStatus, resolveOrgLogoUrl } from '../lib/orgLogo'
import { removeTargetBlueprint } from '../lib/targetList'
import { ensureDfpEngine } from '../lib/dfpEngine'
import {
  buildBootstrapSteps,
  patchBootstrapStep,
  type BootstrapStep,
} from '../lib/bootstrapSteps'
import type { User, Session } from '@supabase/supabase-js'

const AUTH_BOOTSTRAP_TIMEOUT_MS = 12_000
const BOOTSTRAP_FAILSAFE_MS = 45_000

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    )
    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        window.clearTimeout(timer)
        reject(err)
      })
  })
}

export interface UserWithBlueprints {
  id: string
  display_name: string | null
  rsi_handle: string | null
  rsi_handle_verified: boolean
  blueprint_count: number
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  bootstrapSteps: BootstrapStep[]
  isBanned: boolean
  acquiredBlueprints: Record<string, boolean>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  toggleAcquired: (blueprintId: string) => Promise<void>
  updateRsiHandle: (handle: string) => Promise<boolean>
  updateGhostMode: (enabled: boolean) => Promise<boolean>
  updateCraftDeductInventory: (enabled: boolean) => Promise<boolean>
  updateGroupBlueprintVariants: (enabled: boolean) => Promise<boolean>
  groupBlueprintVariants: boolean
  fetchUsersWithBlueprints: () => Promise<UserWithBlueprints[]>
  fetchUserBlueprints: (userId: string) => Promise<Record<string, boolean>>
  refreshProfile: () => Promise<void>
  displayName: string
  isOfficerOrAbove: boolean
  isSuperAdmin: boolean
  isPending: boolean
  isGuestPreview: boolean
  isGhostMode: boolean
  isSociallyHidden: boolean
  enterGuestPreview: () => void
  exitGuestPreview: () => void
  canModifyBlueprints: boolean
  showMemberCollections: boolean
  isApproved: boolean
  canAccess: (minRole: UserRole) => boolean
  visibilityContext: VisibilityContext
  canUseFeature: (featureId: FeatureId) => boolean
  dfpDisplayEnabled: boolean
  updateDfpDisplayEnabled: (enabled: boolean) => Promise<boolean>
  autoApproveEnabled: boolean
  updateAutoApprove: (enabled: boolean) => Promise<boolean>
  orgLogoUrl: string
  orgLogoUpdatedAt: string | null
  orgLogoConfigured: boolean
  refreshOrgLogo: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapSteps, setBootstrapSteps] = useState<BootstrapStep[]>(() => buildBootstrapSteps(false))
  const initialBootstrapDone = useRef(false)
  const [isBanned, setIsBanned] = useState(false)
  const isBannedRef = useRef(false)
  const [acquiredBlueprints, setAcquiredBlueprints] = useState<Record<string, boolean>>({})
  const [dfpDisplayEnabled, setDfpDisplayEnabled] = useState(true)
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false)
  const [orgLogoUpdatedAt, setOrgLogoUpdatedAt] = useState<string | null>(null)
  const [orgLogoConfigured, setOrgLogoConfigured] = useState(false)
  const [isGuestPreview, setIsGuestPreview] = useState(() => readGuestPreviewSession())
  const [guestGroupBlueprintVariants, setGuestGroupBlueprintVariants] = useState(
    () => readGuestGroupBlueprintVariants()
  )

  const enterGuestPreview = useCallback(() => {
    writeGuestPreviewSession(true)
    setIsGuestPreview(true)
    ensureGuestCacheSchema()
    setAcquiredBlueprints(readGuestAcquiredBlueprints())
  }, [])

  const exitGuestPreview = useCallback(() => {
    writeGuestPreviewSession(false)
    setIsGuestPreview(false)
  }, [])

  useEffect(() => {
    if (user || !isGuestPreview) return
    ensureGuestCacheSchema()
    setAcquiredBlueprints(readGuestAcquiredBlueprints())
  }, [user, isGuestPreview])

  useEffect(() => {
    isBannedRef.current = isBanned
  }, [isBanned])

  const checkBanned = useCallback(async (userId: string, email?: string | null): Promise<boolean> => {
    const { data: idBan, error: idError } = await supabase
      .from('banned_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (idError) {
      console.error('Error checking ban status:', idError)
      return false
    }

    if (idBan) return true

    if (email) {
      const { data: emailBan, error: emailError } = await supabase
        .from('banned_users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (emailError) {
        console.error('Error checking ban by email:', emailError)
        return false
      }

      if (emailBan) return true
    }

    return false
  }, [])

  const handleBannedUser = useCallback(async () => {
    setIsBanned(true)
    setProfile(null)
    setAcquiredBlueprints({})
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    return data as Profile
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    const profileData = await fetchProfile(user.id)
    if (profileData) setProfile(profileData)
  }, [user?.id, fetchProfile])

  const refreshOrgLogo = useCallback(async () => {
    const status = await fetchOrgLogoStatus()
    setOrgLogoConfigured(status.configured)
    setOrgLogoUpdatedAt(status.updatedAt)
  }, [])

  useEffect(() => {
    void refreshOrgLogo()
  }, [refreshOrgLogo])

  const orgLogoUrl = useMemo(
    () => resolveOrgLogoUrl(orgLogoUpdatedAt),
    [orgLogoUpdatedAt]
  )

  const fetchSiteSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('dfp_display_enabled, auto_approve_enabled')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching site settings:', error)
      return { dfpDisplayEnabled: true, autoApproveEnabled: false }
    }

    return {
      dfpDisplayEnabled: data?.dfp_display_enabled ?? true,
      autoApproveEnabled: data?.auto_approve_enabled ?? false,
    }
  }, [])

  const fetchAcquiredBlueprints = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('acquired_blueprints')
      .select('blueprint_id')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching acquired blueprints:', error)
      return {}
    }

    const acquired: Record<string, boolean> = {}
    data?.forEach((item: { blueprint_id: string }) => {
      acquired[item.blueprint_id] = true
    })
    return acquired
  }, [])

  const profileRef = useRef(profile)
  profileRef.current = profile

  const loadUserData = useCallback(async (sessionUser: User, isSignIn = false) => {
    const banned = await checkBanned(sessionUser.id, sessionUser.email)
    if (banned) {
      await handleBannedUser()
      return
    }

    setIsBanned(false)
    const profileData = await fetchProfile(sessionUser.id)

    setProfile(profileData)

    if (!profileData) {
      const stillBanned = await checkBanned(sessionUser.id, sessionUser.email)
      if (stillBanned) {
        await handleBannedUser()
        return
      }
    }

    if (isSignIn) {
      await maybeMigrateOfflineData(sessionUser.id)
    }

    const acquired = await fetchAcquiredBlueprints(sessionUser.id)
    setAcquiredBlueprints(acquired)

    const siteSettings = await fetchSiteSettings()
    setDfpDisplayEnabled(siteSettings.dfpDisplayEnabled)
    setAutoApproveEnabled(siteSettings.autoApproveEnabled)
  }, [checkBanned, handleBannedUser, fetchProfile, fetchAcquiredBlueprints, fetchSiteSettings])

  const setStep = useCallback((id: string, patch: Partial<Pick<BootstrapStep, 'status' | 'progress'>>) => {
    setBootstrapSteps((prev) => patchBootstrapStep(prev, id, patch))
  }, [])

  const loadUserDataWithProgress = useCallback(
    async (sessionUser: User, isSignIn = false) => {
      setStep('clearance', { status: 'active', progress: 20 })
      const banned = await checkBanned(sessionUser.id, sessionUser.email)
      if (banned) {
        setStep('clearance', { status: 'error', progress: 100 })
        await handleBannedUser()
        return false
      }
      setStep('clearance', { status: 'done', progress: 100 })

      setStep('profile', { status: 'active', progress: 25 })
      const profileData = await fetchProfile(sessionUser.id)
      setIsBanned(false)
      setProfile(profileData)

      if (!profileData) {
        const stillBanned = await checkBanned(sessionUser.id, sessionUser.email)
        if (stillBanned) {
          setStep('profile', { status: 'error', progress: 100 })
          await handleBannedUser()
          return false
        }
      }
      setStep('profile', { status: 'done', progress: 100 })

      if (isSignIn) {
        await maybeMigrateOfflineData(sessionUser.id)
      }

      setStep('blueprints', { status: 'active', progress: 30 })
      const acquired = await fetchAcquiredBlueprints(sessionUser.id)
      setAcquiredBlueprints(acquired)
      setStep('blueprints', { status: 'done', progress: 100 })

      setStep('settings', { status: 'active', progress: 40 })
      const siteSettings = await fetchSiteSettings()
      setDfpDisplayEnabled(siteSettings.dfpDisplayEnabled)
      setAutoApproveEnabled(siteSettings.autoApproveEnabled)
      setStep('settings', { status: 'done', progress: 100 })

      return true
    },
    [
      checkBanned,
      handleBannedUser,
      fetchProfile,
      fetchAcquiredBlueprints,
      fetchSiteSettings,
      setStep,
    ]
  )

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      setLoading(true)
      setBootstrapSteps(buildBootstrapSteps(false))

      try {
        const hash = window.location.hash
        const isOAuthCallback = hash.includes('access_token')

        setStep('session', { status: 'active', progress: 15 })
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          'auth.getSession'
        )

        if (isOAuthCallback && session && !error) {
          window.history.replaceState(null, '', window.location.pathname)
        }

        if (cancelled) return

        setSession(session)
        setUser(session?.user ?? null)

        const stepsAfterSession = buildBootstrapSteps(!!session?.user).map((step) =>
          step.id === 'session' ? { ...step, status: 'done' as const, progress: 100 } : step
        )
        setBootstrapSteps(stepsAfterSession)

        if (session?.user) {
          const ok = await loadUserDataWithProgress(session.user, isOAuthCallback)
          if (!ok || cancelled) return
        }

        setBootstrapSteps((prev) => patchBootstrapStep(prev, 'dfp', { status: 'active', progress: 20 }))
        await ensureDfpEngine()
        if (cancelled) return
        setBootstrapSteps((prev) => patchBootstrapStep(prev, 'dfp', { status: 'done', progress: 100 }))
      } catch (err) {
        console.error('Auth bootstrap failed:', err)
        setBootstrapSteps((prev) =>
          prev.map((step) =>
            step.status === 'active'
              ? { ...step, status: 'error', progress: 100 }
              : step.status === 'pending'
                ? { ...step, status: 'skipped' }
                : step
          )
        )
      } finally {
        if (!cancelled) {
          initialBootstrapDone.current = true
          setLoading(false)
        }
      }
    }

    void bootstrapAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialBootstrapDone.current) return

      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        await loadUserData(session.user, event === 'SIGNED_IN')
      } else if (!isBannedRef.current) {
        setProfile(null)
        setAcquiredBlueprints({})
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadUserData, loadUserDataWithProgress, setStep])

  useEffect(() => {
    if (!loading) return
    const id = window.setTimeout(() => {
      console.warn('Bootstrap failsafe: completing with partial data')
      setBootstrapSteps((prev) =>
        prev.map((step) =>
          step.status === 'active'
            ? { ...step, status: 'error', progress: 100 }
            : step.status === 'pending'
              ? { ...step, status: 'skipped' }
              : step
        )
      )
      initialBootstrapDone.current = true
      setLoading(false)
    }, BOOTSTRAP_FAILSAFE_MS)
    return () => window.clearTimeout(id)
  }, [loading])

  useEffect(() => {
    const onFocus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const banned = await checkBanned(session.user.id, session.user.email)
      if (banned) {
        await handleBannedUser()
        return
      }

      const profileData = await fetchProfile(session.user.id)
      if (profileData) setProfile(profileData)
    }

    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [checkBanned, handleBannedUser, fetchProfile])

  const userRef = useRef(user)
  userRef.current = user
  const acquiredRef = useRef(acquiredBlueprints)
  acquiredRef.current = acquiredBlueprints

  const signInWithGoogle = useCallback(async () => {
    writeGuestPreviewSession(false)
    setIsGuestPreview(false)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      console.error('Error signing in:', error)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
      throw error
    }
    setIsBanned(false)
  }, [])

  const toggleAcquired = useCallback(async (blueprintId: string) => {
    const activeUser = userRef.current
    const activeProfile = profileRef.current
    const isGuestMode = !activeUser && readGuestPreviewSession()

    // Guest mode: localStorage only
    if (isGuestMode) {
      const normalizedId = normalizeGuestBlueprintId(blueprintId)
      if (!normalizedId) {
        console.warn('Cannot toggle acquired: unknown blueprint id', blueprintId)
        return
      }

      const current = acquiredRef.current
      const isCurrentlyAcquired = current[normalizedId]
      const updated = { ...current }

      if (isCurrentlyAcquired) {
        delete updated[normalizedId]
      } else {
        updated[normalizedId] = true
      }

      writeGuestAcquiredBlueprints(updated)
      setAcquiredBlueprints(updated)
      return
    }

    if (!activeUser || !activeProfile || activeProfile.role === 'pending') {
      console.warn('Cannot toggle: user not authenticated or pending')
      return
    }

    const isCurrentlyAcquired = acquiredRef.current[blueprintId]

    if (isCurrentlyAcquired) {
      const { error } = await supabase
        .from('acquired_blueprints')
        .delete()
        .eq('user_id', activeUser.id)
        .eq('blueprint_id', blueprintId)

      if (!error) {
        setAcquiredBlueprints(prev => {
          const updated = { ...prev }
          delete updated[blueprintId]
          return updated
        })
      }
    } else {
      const { error } = await supabase
        .from('acquired_blueprints')
        .insert({ user_id: activeUser.id, blueprint_id: blueprintId })

      if (!error) {
        setAcquiredBlueprints(prev => ({
          ...prev,
          [blueprintId]: true,
        }))
        await removeTargetBlueprint(activeUser.id, blueprintId)
      }
    }
  }, [])

  const updateRsiHandle = useCallback(async (handle: string): Promise<boolean> => {
    const activeUser = userRef.current
    if (!activeUser) return false

    const trimmedHandle = handle.trim() || null
    const { error } = await supabase
      .from('profiles')
      .update({ rsi_handle: trimmedHandle })
      .eq('id', activeUser.id)

    if (error) {
      console.error('Error updating RSI handle:', error)
      return false
    }

    setProfile(prev => prev ? { ...prev, rsi_handle: trimmedHandle } : null)
    return true
  }, [])

  const updateGhostMode = useCallback(async (enabled: boolean): Promise<boolean> => {
    const activeUser = userRef.current
    if (!activeUser) return false

    const { error } = await supabase
      .from('profiles')
      .update({ ghost_mode: enabled })
      .eq('id', activeUser.id)

    if (error) {
      console.error('Error updating ghost mode:', error)
      return false
    }

    setProfile(prev => prev ? { ...prev, ghost_mode: enabled } : null)
    return true
  }, [])

  const updateCraftDeductInventory = useCallback(async (enabled: boolean): Promise<boolean> => {
    const activeUser = userRef.current
    if (!activeUser) return false

    const { error } = await supabase
      .from('profiles')
      .update({ craft_deduct_inventory: enabled })
      .eq('id', activeUser.id)

    if (error) {
      console.error('Error updating craft deduct inventory:', error)
      return false
    }

    setProfile(prev => prev ? { ...prev, craft_deduct_inventory: enabled } : null)
    return true
  }, [])

  const updateGroupBlueprintVariants = useCallback(async (enabled: boolean): Promise<boolean> => {
    const activeUser = userRef.current
    if (!activeUser) {
      if (isGuestPreview) {
        writeGuestGroupBlueprintVariants(enabled)
        setGuestGroupBlueprintVariants(enabled)
        return true
      }
      return false
    }

    const { error } = await supabase
      .from('profiles')
      .update({ group_blueprint_variants: enabled })
      .eq('id', activeUser.id)

    if (error) {
      console.error('Error updating group blueprint variants setting:', error)
      return false
    }

    setProfile(prev => prev ? { ...prev, group_blueprint_variants: enabled } : null)
    return true
  }, [isGuestPreview])

  const updateDfpDisplayEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    const activeProfile = profileRef.current
    if (activeProfile?.role !== 'super-admin') return false

    const { error } = await supabase.rpc('update_site_dfp_display', { p_enabled: enabled })

    if (error) {
      console.error('Error updating DFP display setting:', error)
      return false
    }

    setDfpDisplayEnabled(enabled)
    return true
  }, [])

  const updateAutoApprove = useCallback(async (enabled: boolean): Promise<boolean> => {
    const activeProfile = profileRef.current
    if (activeProfile?.role !== 'super-admin') return false

    const { error } = await supabase.rpc('update_site_auto_approve', { p_enabled: enabled })

    if (error) {
      console.error('Error updating auto-approve setting:', error)
      return false
    }

    setAutoApproveEnabled(enabled)
    return true
  }, [])

  const fetchUsersWithBlueprints = useCallback(async (): Promise<UserWithBlueprints[]> => {
    const { data: blueprintCounts, error: countError } = await supabase
      .from('acquired_blueprints')
      .select('user_id')
    
    if (countError) {
      console.error('Error fetching blueprint counts:', countError)
      return []
    }

    const userCounts: Record<string, number> = {}
    blueprintCounts?.forEach(item => {
      userCounts[item.user_id] = (userCounts[item.user_id] || 0) + 1
    })

    const userIdsWithBlueprints = Object.keys(userCounts)
    if (userIdsWithBlueprints.length === 0) return []

    const profileQuery = supabase
      .from('profiles')
      .select('id, display_name, rsi_handle, rsi_handle_verified, role')
      .in('id', userIdsWithBlueprints)
      .neq('role', 'pending')
      .eq('ghost_mode', false)

    const { data: profiles, error: profileError } = await profileQuery

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return []
    }

    const activeProfile = profileRef.current
    const isOfficerOrAbove =
      activeProfile?.role === 'officer' || activeProfile?.role === 'super-admin'

    return (profiles || [])
      .filter((p) => !(isOfficerOrAbove && p.id === activeProfile?.id))
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        rsi_handle: p.rsi_handle,
        rsi_handle_verified: p.rsi_handle_verified ?? false,
        blueprint_count: userCounts[p.id] || 0,
      }))
      .sort((a, b) => {
        const nameA = a.rsi_handle || a.display_name || ''
        const nameB = b.rsi_handle || b.display_name || ''
        return nameA.localeCompare(nameB)
      })
  }, [])

  const fetchUserBlueprints = useCallback(async (userId: string): Promise<Record<string, boolean>> => {
    const { data, error } = await supabase
      .from('acquired_blueprints')
      .select('blueprint_id')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user blueprints:', error)
      return {}
    }

    const acquired: Record<string, boolean> = {}
    data?.forEach((item: { blueprint_id: string }) => {
      acquired[item.blueprint_id] = true
    })
    return acquired
  }, [])

  const isOfficerOrAbove = profile?.role === 'officer' || profile?.role === 'super-admin'
  const isSuperAdmin = profile?.role === 'super-admin'
  const isPending = profile?.role === 'pending'
  const isGhostMode = profile?.ghost_mode ?? false
  const guestPreviewActive = !user && isGuestPreview
  const groupBlueprintVariants =
    profile?.group_blueprint_variants ?? (guestPreviewActive ? guestGroupBlueprintVariants : false)
  const canModifyBlueprints = guestPreviewActive || (!!profile && profile.role !== 'pending')
  const isApproved = !!profile && profile.role !== 'pending'
  const visibilityContext = useMemo(
    () =>
      buildVisibilityContext({
        role: profile?.role ?? null,
        ghostMode: profile?.ghost_mode ?? false,
        isGuestPreview: guestPreviewActive,
      }),
    [
      profile?.role,
      profile?.ghost_mode,
      guestPreviewActive,
    ]
  )

  useEffect(() => {
    if (user) {
      writeGuestPreviewSession(false)
      setIsGuestPreview(false)
    }
  }, [user])
  const showMemberCollections = canUseFeature('member_directory', visibilityContext)
  const isSociallyHidden = visibilityContext.isSociallyHidden
  const canAccess = useCallback(
    (minRole: UserRole) => roleAtLeast(profile?.role, minRole),
    [profile?.role]
  )
  const checkFeature = useCallback(
    (featureId: FeatureId) => canUseFeature(featureId, visibilityContext),
    [visibilityContext]
  )
  const displayName = getDisplayName(profile)

  const contextValue = useMemo(
    () => ({
      user,
      profile,
      session,
      loading,
      bootstrapSteps,
      isBanned,
      acquiredBlueprints,
      signInWithGoogle,
      signOut,
      toggleAcquired,
      updateRsiHandle,
      updateGhostMode,
      updateCraftDeductInventory,
      updateGroupBlueprintVariants,
      groupBlueprintVariants,
      fetchUsersWithBlueprints,
      fetchUserBlueprints,
      refreshProfile,
      displayName,
      isOfficerOrAbove,
      isSuperAdmin,
      isPending,
      isGuestPreview: guestPreviewActive,
      isGhostMode,
      isSociallyHidden,
      enterGuestPreview,
      exitGuestPreview,
      canModifyBlueprints,
      showMemberCollections,
      isApproved,
      canAccess,
      visibilityContext,
      canUseFeature: checkFeature,
      dfpDisplayEnabled,
      updateDfpDisplayEnabled,
      autoApproveEnabled,
      updateAutoApprove,
      orgLogoUrl,
      orgLogoUpdatedAt,
      orgLogoConfigured,
      refreshOrgLogo,
    }),
    [
      user,
      profile,
      session,
      loading,
      bootstrapSteps,
      isBanned,
      acquiredBlueprints,
      signInWithGoogle,
      signOut,
      toggleAcquired,
      updateRsiHandle,
      updateGhostMode,
      updateCraftDeductInventory,
      updateGroupBlueprintVariants,
      groupBlueprintVariants,
      fetchUsersWithBlueprints,
      fetchUserBlueprints,
      refreshProfile,
      displayName,
      isOfficerOrAbove,
      isSuperAdmin,
      isPending,
      guestPreviewActive,
      isGhostMode,
      isSociallyHidden,
      enterGuestPreview,
      exitGuestPreview,
      canModifyBlueprints,
      showMemberCollections,
      isApproved,
      canAccess,
      visibilityContext,
      checkFeature,
      dfpDisplayEnabled,
      updateDfpDisplayEnabled,
      autoApproveEnabled,
      updateAutoApprove,
      orgLogoUrl,
      orgLogoUpdatedAt,
      orgLogoConfigured,
      refreshOrgLogo,
    ]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
