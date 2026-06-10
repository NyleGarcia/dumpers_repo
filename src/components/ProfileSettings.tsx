import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { deleteAccount, supabase } from '../lib/supabase'
import SettingsSection from './settings/SettingsSection'
import SettingsField from './settings/SettingsField'
import SettingsToggle from './settings/SettingsToggle'
import AppModal from './layout/AppModal'

export default function ProfileSettings({ onClose }: { onClose: () => void }) {
  const {
    user,
    profile,
    updateRsiHandle,
    updateGhostMode,
    updateCraftDeductInventory,
    updateDfpDisplayEnabled,
    dfpDisplayEnabled,
    autoApproveEnabled,
    updateAutoApprove,
    signOut,
    isSuperAdmin,
  } = useAuth()
  const [rsiHandle, setRsiHandle] = useState(profile?.rsi_handle || '')
  const [ghostMode, setGhostMode] = useState(profile?.ghost_mode ?? false)
  const [savingRsi, setSavingRsi] = useState(false)
  const [savingGhost, setSavingGhost] = useState(false)
  const [craftDeductInventory, setCraftDeductInventory] = useState(
    profile?.craft_deduct_inventory ?? false
  )
  const [savingCraftDeduct, setSavingCraftDeduct] = useState(false)
  const [savingDfpDisplay, setSavingDfpDisplay] = useState(false)
  const [savingAutoApprove, setSavingAutoApprove] = useState(false)
  const [showWelcomeAlways, setShowWelcomeAlways] = useState(false)
  const [savingWelcome, setSavingWelcome] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasActiveOrders, setHasActiveOrders] = useState(false)
  const [checkingOrders, setCheckingOrders] = useState(true)

  const hasRsiHandle = !!(profile?.rsi_handle && profile.rsi_handle.trim())

  // Check if user has active orders (as buyer or fulfiller)
  useEffect(() => {
    if (!user?.id) {
      setCheckingOrders(false)
      return
    }

    const checkActiveOrders = async () => {
      try {
        // Check for active orders as requester
        const { count: requesterCount } = await supabase
          .from('custom_orders')
          .select('*', { count: 'exact', head: true })
          .eq('requester_id', user.id)
          .in('status', ['pending', 'accepted', 'in_progress'])

        // Check for active orders as assignee/fulfiller
        const { count: assigneeCount } = await supabase
          .from('custom_orders')
          .select('*', { count: 'exact', head: true })
          .eq('assignee_id', user.id)
          .in('status', ['accepted', 'in_progress'])

        setHasActiveOrders((requesterCount ?? 0) > 0 || (assigneeCount ?? 0) > 0)
      } catch {
        // If query fails, assume no active orders
        setHasActiveOrders(false)
      }
      setCheckingOrders(false)
    }

    checkActiveOrders()
  }, [user?.id])

  // Load welcome modal setting for super-admin
  useEffect(() => {
    if (!isSuperAdmin) return
    const loadWelcomeSetting = async () => {
      try {
        const { data } = await supabase.rpc('get_welcome_modal_status')
        if (data) {
          setShowWelcomeAlways(data.always_show ?? false)
        }
      } catch {
        // Migration may not be run yet
      }
    }
    loadWelcomeSetting()
  }, [isSuperAdmin])

  useEffect(() => {
    setRsiHandle(profile?.rsi_handle || '')
    setGhostMode(profile?.ghost_mode ?? false)
    setCraftDeductInventory(profile?.craft_deduct_inventory ?? false)
  }, [
    profile?.rsi_handle,
    profile?.ghost_mode,
    profile?.craft_deduct_inventory,
  ])

  const handleSaveRsi = async () => {
    setSavingRsi(true)
    setMessage(null)

    const success = await updateRsiHandle(rsiHandle)

    if (success) {
      setMessage({ type: 'success', text: 'RSI handle saved.' })
    } else {
      setMessage({ type: 'error', text: 'Failed to save RSI handle.' })
    }

    setSavingRsi(false)
  }

  const handleGhostModeChange = async (enabled: boolean) => {
    const previous = ghostMode
    setGhostMode(enabled)
    setSavingGhost(true)
    setMessage(null)

    const success = await updateGhostMode(enabled)

    if (!success) {
      setGhostMode(previous)
      setMessage({ type: 'error', text: 'Failed to update Ghost Mode.' })
    }

    setSavingGhost(false)
  }

  const handleDfpDisplayChange = async (enabled: boolean) => {
    setSavingDfpDisplay(true)
    setMessage(null)

    const success = await updateDfpDisplayEnabled(enabled)

    if (!success) {
      setMessage({ type: 'error', text: 'Failed to update DFP display setting.' })
    }

    setSavingDfpDisplay(false)
  }

  const handleAutoApproveChange = async (enabled: boolean) => {
    setSavingAutoApprove(true)
    setMessage(null)

    const success = await updateAutoApprove(enabled)

    if (!success) {
      setMessage({ type: 'error', text: 'Failed to update auto-approve setting.' })
    }

    setSavingAutoApprove(false)
  }

  const handleWelcomeAlwaysChange = async (enabled: boolean) => {
    const previous = showWelcomeAlways
    setShowWelcomeAlways(enabled)
    setSavingWelcome(true)
    setMessage(null)

    try {
      const { error } = await supabase.rpc('update_show_welcome_modal_always', { p_enabled: enabled })
      if (error) throw error
      setMessage({ type: 'success', text: enabled ? 'Welcome modal will show on next page load.' : 'Welcome modal testing disabled.' })
    } catch {
      setShowWelcomeAlways(previous)
      setMessage({ type: 'error', text: 'Failed to update welcome modal setting.' })
    }

    setSavingWelcome(false)
  }

  const handleCraftDeductInventoryChange = async (enabled: boolean) => {
    const previous = craftDeductInventory
    setCraftDeductInventory(enabled)
    setSavingCraftDeduct(true)
    setMessage(null)

    const success = await updateCraftDeductInventory(enabled)

    if (!success) {
      setCraftDeductInventory(previous)
      setMessage({ type: 'error', text: 'Failed to update craft inventory setting.' })
    }

    setSavingCraftDeduct(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return

    setDeleting(true)
    setMessage(null)

    const result = await deleteAccount()

    if (!result.success) {
      setMessage({ type: 'error', text: result.error || 'Failed to delete account' })
      setDeleting(false)
      return
    }

    await signOut()
    onClose()
  }

  return (
    <AppModal
      title="Settings"
      subtitle="Profile, privacy, and account"
      onClose={onClose}
      size="md"
      zIndex={70}
      footer={
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4">
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-900/50 border border-green-500/50 text-green-400'
                : 'bg-red-900/50 border border-red-500/50 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <SettingsSection
            title="Profile"
            description="How you appear to other players"
          >
            <SettingsField
              label="RSI Handle"
              hint={
                hasActiveOrders && hasRsiHandle
                  ? "You have active orders — clear them before changing your handle."
                  : "Required for Custom Orders and Fulfillment features."
              }
            >
              <input
                type="text"
                value={rsiHandle}
                onChange={(e) => setRsiHandle(e.target.value)}
                placeholder="Enter your RSI handle..."
                disabled={hasActiveOrders && hasRsiHandle}
                className={`w-full px-4 py-2.5 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-all text-sm ${
                  hasActiveOrders && hasRsiHandle
                    ? 'border-slate-700 opacity-60 cursor-not-allowed'
                    : 'border-slate-600 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20'
                }`}
              />
            </SettingsField>
            <button
              onClick={handleSaveRsi}
              disabled={savingRsi || (hasActiveOrders && hasRsiHandle)}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingRsi ? 'Saving...' : hasActiveOrders && hasRsiHandle ? 'Active orders — cannot change' : 'Save RSI Handle'}
            </button>

            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <SettingsToggle
                label="Deduct inventory on craft complete"
                description={
                  hasRsiHandle
                    ? "When on, completing a fulfillment craft requires enough stock in My Resources and deducts materials automatically."
                    : "Set your RSI Handle above to enable this feature."
                }
                checked={craftDeductInventory}
                onChange={handleCraftDeductInventoryChange}
                saving={savingCraftDeduct}
                disabled={!hasRsiHandle}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            title="Privacy"
            description="Control visibility to other members"
          >
            <SettingsToggle
              label="Ghost Mode"
              description="Hide the member blueprint list from your view and remove yourself from that list for others. You can still track your own blueprints."
              checked={ghostMode}
              onChange={handleGhostModeChange}
              saving={savingGhost}
            />
          </SettingsSection>

          {isSuperAdmin && (
            <SettingsSection
              title="Site"
              description="Franchise-wide instance settings"
            >
              <SettingsToggle
                label="Disable DFP display"
                description="Hide Dumper's Fair-Value Price amounts in the UI. The opt-out notice will automatically appear at the bottom of every page while this is off."
                checked={!dfpDisplayEnabled}
                onChange={(disabled) => handleDfpDisplayChange(!disabled)}
                saving={savingDfpDisplay}
              />
              <SettingsToggle
                label="Auto-approve new signups"
                description="When enabled, new Google sign-ins are automatically approved as members instead of requiring officer approval."
                checked={autoApproveEnabled}
                onChange={handleAutoApproveChange}
                saving={savingAutoApprove}
              />
              <SettingsToggle
                label="Always show Welcome Modal (testing)"
                description="When enabled, the welcome onboarding modal appears on every page load. Use this to preview/test the modal before rolling out to all users."
                checked={showWelcomeAlways}
                onChange={handleWelcomeAlwaysChange}
                saving={savingWelcome}
              />
            </SettingsSection>
          )}

          <SettingsSection
            title="Account"
            description="Permanent account actions"
            variant="danger"
          >
            {isSuperAdmin ? (
              <p className="text-sm text-slate-500">
                Super-admin accounts cannot be self-deleted.
              </p>
            ) : !showDeleteConfirm ? (
              <>
                <p className="text-sm text-slate-400">
                  Remove your blueprint data and sign-in permanently.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-4 py-2.5 bg-red-950/50 hover:bg-red-900/50 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg transition-colors"
                >
                  Delete My Account
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Type <span className="text-white font-mono">DELETE</span> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-red-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 text-sm"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setDeleteConfirmText('')
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText !== 'DELETE'}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </SettingsSection>
      </div>
    </AppModal>
  )
}
