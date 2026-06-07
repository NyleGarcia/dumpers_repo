import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { deleteAccount } from '../lib/supabase'
import SettingsSection from './settings/SettingsSection'
import SettingsField from './settings/SettingsField'
import SettingsToggle from './settings/SettingsToggle'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { canManageOrgPrivacy } from '../lib/featureAccess'
import { isDumpersOrg, ORG_ROLE_LABELS, setOrgResourcesPublic } from '../lib/org'

export default function ProfileSettings({ onClose }: { onClose: () => void }) {
  useBodyScrollLock()
  const {
    profile,
    organization,
    orgMembership,
    updateRsiHandle,
    updateGhostMode,
    updatePreviewFeatures,
    updateOrgOnlyMode,
    updateFulfillmentEnabled,
    updateSharePersonalResources,
    refreshOrgContext,
    reloadProfile,
    visibilityContext,
    signOut,
    isSuperAdmin,
    isOfficerOrAbove,
  } = useAuth()
  const [rsiHandle, setRsiHandle] = useState(profile?.rsi_handle || '')
  const [ghostMode, setGhostMode] = useState(profile?.ghost_mode ?? false)
  const [previewFeatures, setPreviewFeatures] = useState(profile?.preview_features_enabled ?? false)
  const [orgOnlyMode, setOrgOnlyMode] = useState(profile?.org_only_mode ?? false)
  const [fulfillmentEnabled, setFulfillmentEnabled] = useState(profile?.fulfillment_enabled ?? false)
  const [savingRsi, setSavingRsi] = useState(false)
  const [savingGhost, setSavingGhost] = useState(false)
  const [savingPreview, setSavingPreview] = useState(false)
  const [savingOrgOnly, setSavingOrgOnly] = useState(false)
  const [savingFulfillment, setSavingFulfillment] = useState(false)
  const [resourcesPublic, setResourcesPublic] = useState(organization?.resources_public ?? false)
  const [savingResourcesPublic, setSavingResourcesPublic] = useState(false)
  const [sharePersonalResources, setSharePersonalResources] = useState(
    profile?.share_personal_resources ?? false
  )
  const [savingSharePersonal, setSavingSharePersonal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [orgSetupLoading, setOrgSetupLoading] = useState(false)

  const hasOrgAffiliation = !!(organization || profile?.org_id)

  const runOrgSetup = async () => {
    setOrgSetupLoading(true)
    try {
      await reloadProfile()
    } finally {
      setOrgSetupLoading(false)
    }
  }

  useEffect(() => {
    if (!profile?.id || organization || profile?.org_id) return
    void runOrgSetup()
  }, [profile?.id, profile?.org_id, organization, reloadProfile])

  useEffect(() => {
    setRsiHandle(profile?.rsi_handle || '')
    setGhostMode(profile?.ghost_mode ?? false)
    setPreviewFeatures(profile?.preview_features_enabled ?? false)
    setOrgOnlyMode(profile?.org_only_mode ?? false)
    setFulfillmentEnabled(profile?.fulfillment_enabled ?? false)
  }, [
    profile?.rsi_handle,
    profile?.ghost_mode,
    profile?.preview_features_enabled,
    profile?.org_only_mode,
    profile?.fulfillment_enabled,
    organization?.resources_public,
    profile?.share_personal_resources,
  ])

  useEffect(() => {
    setResourcesPublic(organization?.resources_public ?? false)
  }, [organization?.resources_public])

  useEffect(() => {
    setSharePersonalResources(profile?.share_personal_resources ?? false)
  }, [profile?.share_personal_resources])

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

  const handlePreviewFeaturesChange = async (enabled: boolean) => {
    const previous = previewFeatures
    setPreviewFeatures(enabled)
    setSavingPreview(true)
    setMessage(null)

    const success = await updatePreviewFeatures(enabled)

    if (!success) {
      setPreviewFeatures(previous)
      setMessage({ type: 'error', text: 'Failed to update Feature Preview.' })
    }

    setSavingPreview(false)
  }

  const handleOrgOnlyModeChange = async (enabled: boolean) => {
    const previous = orgOnlyMode
    setOrgOnlyMode(enabled)
    setSavingOrgOnly(true)
    setMessage(null)

    const success = await updateOrgOnlyMode(enabled)

    if (!success) {
      setOrgOnlyMode(previous)
      setMessage({ type: 'error', text: 'Failed to update Org-only mode.' })
    }

    setSavingOrgOnly(false)
  }

  const handleFulfillmentEnabledChange = async (enabled: boolean) => {
    const previous = fulfillmentEnabled
    setFulfillmentEnabled(enabled)
    setSavingFulfillment(true)
    setMessage(null)

    const success = await updateFulfillmentEnabled(enabled)

    if (!success) {
      setFulfillmentEnabled(previous)
      setMessage({ type: 'error', text: 'Failed to update fulfillment setting.' })
    }

    setSavingFulfillment(false)
  }

  const handleResourcesPublicChange = async (enabled: boolean) => {
    const previous = resourcesPublic
    setResourcesPublic(enabled)
    setSavingResourcesPublic(true)
    setMessage(null)

    const result = await setOrgResourcesPublic(enabled)

    if (result.error) {
      setResourcesPublic(previous)
      setMessage({ type: 'error', text: result.error })
    } else {
      await refreshOrgContext()
    }

    setSavingResourcesPublic(false)
  }

  const handleSharePersonalResourcesChange = async (enabled: boolean) => {
    const previous = sharePersonalResources
    setSharePersonalResources(enabled)
    setSavingSharePersonal(true)
    setMessage(null)

    const success = await updateSharePersonalResources(enabled)

    if (!success) {
      setSharePersonalResources(previous)
      setMessage({ type: 'error', text: 'Failed to update personal resource sharing.' })
    }

    setSavingSharePersonal(false)
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Profile, org, privacy, and account</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
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
            description="How you appear to other members"
          >
            <SettingsField
              label="RSI Handle"
              hint="Shown instead of your Google name across the app."
            >
              <input
                type="text"
                value={rsiHandle}
                onChange={(e) => setRsiHandle(e.target.value)}
                placeholder="Enter your RSI handle..."
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all text-sm"
              />
            </SettingsField>
            <button
              onClick={handleSaveRsi}
              disabled={savingRsi}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {savingRsi ? 'Saving...' : 'Save RSI Handle'}
            </button>
          </SettingsSection>

          {hasOrgAffiliation && (
            <SettingsSection
              title="Organization"
              description="Your org affiliation and org-scoped preferences"
            >
              {orgSetupLoading ? (
                <p className="text-sm text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-3">
                  Loading organization...
                </p>
              ) : organization || profile?.org_id ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">Org</span>
                  <span className="text-sm font-medium text-white">
                    {organization?.name ?? 'Dumpers'}
                  </span>
                </div>
                {orgMembership && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-400">Org role</span>
                    <span className="text-sm font-medium text-purple-300">
                      {ORG_ROLE_LABELS[orgMembership.org_role]}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">Verification</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      orgMembership?.verified_at
                        ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                        : 'bg-amber-900/30 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {orgMembership?.verified_at ? 'Verified org mate' : 'Pending verification'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">Org stock visibility</span>
                  <span className="text-xs text-slate-400">
                    {organization?.resources_public !== false
                      ? 'Other orgs can view shared org stock'
                      : 'Org stock visible to your org only'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Personal resources are never visible across orgs. Same-org mates only see yours if
                  you opt in below (Dumpers members are always visible to each other after verify).
                </p>
                {!orgMembership?.verified_at && organization && !isDumpersOrg(organization) && (
                  <p className="text-xs text-amber-300/80 pt-1">
                    Org stock is hidden until an officer verifies your membership.
                  </p>
                )}
                {(!organization || isDumpersOrg(organization)) && (
                  <p className="text-xs text-slate-500 pt-1">
                    Every member starts in Dumpers Repo. Switch to another org later when org
                    transfer is available.
                  </p>
                )}
              </div>
              ) : null}

              {organization && canManageOrgPrivacy(visibilityContext) && (
                isDumpersOrg(organization) ? (
                  <p className="text-sm text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-2">
                    Dumpers Repo shared org stock is always public to other orgs. Verified Dumpers
                    members can always see each other&apos;s personal stock — never visible outside
                    Dumpers.
                  </p>
                ) : (
                  <SettingsToggle
                    label="Public org stock"
                    description="When on, members of other organizations can view your org's shared stock (not anyone's personal inventory)."
                    checked={resourcesPublic}
                    onChange={handleResourcesPublicChange}
                    saving={savingResourcesPublic}
                  />
                )
              )}

              {organization && !isDumpersOrg(organization) && (
                <SettingsToggle
                  label="Share my personal resources"
                  description="Let other verified members of your org see your personal stock. Never visible to other orgs or non-members."
                  checked={sharePersonalResources}
                  onChange={handleSharePersonalResourcesChange}
                  saving={savingSharePersonal}
                />
              )}

              {organization && (
                <>
                  <SettingsToggle
                    label="Org-only views"
                    description="Default member lists and data views to your organization instead of all site members."
                    checked={orgOnlyMode}
                    onChange={handleOrgOnlyModeChange}
                    saving={savingOrgOnly}
                  />

                  <SettingsToggle
                    label="Fulfillment volunteer"
                    description="Opt in to accept and fulfill custom orders when fulfillment launches for members."
                    checked={fulfillmentEnabled}
                    onChange={handleFulfillmentEnabledChange}
                    saving={savingFulfillment}
                  />
                </>
              )}
            </SettingsSection>
          )}

          {!hasOrgAffiliation && (
            <SettingsSection
              title="Organization"
              description="Your default Dumpers Repo membership"
            >
              <p className="text-sm text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-3">
                {orgSetupLoading
                  ? 'Setting up your Dumpers Repo membership...'
                  : 'Organization setup did not complete. Refresh the page or sign in again.'}
              </p>
            </SettingsSection>
          )}

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

          {isOfficerOrAbove && (
            <SettingsSection
              title="Officer Tools"
              description="Access in-development features while testing"
            >
              {isSuperAdmin ? (
                <p className="text-sm text-slate-400">
                  Feature Preview is always enabled for super-admins.
                </p>
              ) : (
                <SettingsToggle
                  label="Feature Preview"
                  description="Show preview navigation for Resource Tracker, Custom Orders, Fulfillment, and future tools."
                  checked={previewFeatures}
                  onChange={handlePreviewFeaturesChange}
                  saving={savingPreview}
                />
              )}
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

        <div className="p-4 border-t border-slate-700 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
