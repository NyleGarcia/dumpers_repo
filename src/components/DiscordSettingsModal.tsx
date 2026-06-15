import React, { useState, useEffect } from 'react'
import {
  getDiscordSettings,
  updateDiscordSettings,
  getDiscordQueueStatus,
  clearDiscordQueue,
  getDiscordWebhooks,
  toggleDiscordWebhook,
  deleteDiscordWebhook,
  processDiscordQueue,
  DiscordSettings,
  DiscordWebhook,
  QueueStatus,
} from '../lib/discord'
import AppModal from './layout/AppModal'

export default function DiscordSettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<DiscordSettings | null>(null)
  const [webhooks, setWebhooks] = useState<DiscordWebhook[]>([])
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state for official webhook
  const [officialUrl, setOfficialUrl] = useState('')
  const [officialName, setOfficialName] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    const [settingsRes, webhooksRes, statusRes] = await Promise.all([
      getDiscordSettings(),
      getDiscordWebhooks(),
      getDiscordQueueStatus(),
    ])

    if (settingsRes.success && settingsRes.settings) {
      setSettings(settingsRes.settings)
      setOfficialUrl(settingsRes.settings.official_webhook_url || '')
      setOfficialName(settingsRes.settings.official_webhook_name || '')
    }

    if (webhooksRes.success && webhooksRes.webhooks) {
      setWebhooks(webhooksRes.webhooks)
    }

    if (statusRes.success && statusRes.status) {
      setQueueStatus(statusRes.status)
    }

    setLoading(false)
  }

  const handleToggleSetting = async (key: keyof DiscordSettings) => {
    if (!settings) return

    setSaving(true)
    const newValue = !settings[key]
    const result = await updateDiscordSettings({ [key]: newValue })

    if (result.success) {
      setSettings({ ...settings, [key]: newValue })
      setMessage({ type: 'success', text: `${key.replace(/_/g, ' ')} updated` })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update setting' })
    }
    setSaving(false)
  }

  const handleSaveOfficialWebhook = async () => {
    setSaving(true)
    const result = await updateDiscordSettings({
      official_webhook_url: officialUrl || undefined,
      official_webhook_name: officialName || undefined,
    })

    if (result.success) {
      setSettings(prev => prev ? {
        ...prev,
        official_webhook_url: officialUrl,
        official_webhook_name: officialName,
      } : null)
      setMessage({ type: 'success', text: 'Official webhook saved' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save webhook' })
    }
    setSaving(false)
  }

  const handleProcessQueue = async () => {
    setProcessing(true)
    setMessage(null)

    const result = await processDiscordQueue()

    if (result.success) {
      setMessage({
        type: 'success',
        text: `Processed ${result.processed} messages, sent ${result.sent} notifications`,
      })
      // Refresh queue status
      const statusRes = await getDiscordQueueStatus()
      if (statusRes.success && statusRes.status) {
        setQueueStatus(statusRes.status)
      }
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to process queue' })
    }
    setProcessing(false)
  }

  const handleClearQueue = async (onlyProcessed: boolean) => {
    setProcessing(true)
    const result = await clearDiscordQueue(onlyProcessed)

    if (result.success) {
      setMessage({
        type: 'success',
        text: `Cleared ${result.deleted} messages from queue`,
      })
      const statusRes = await getDiscordQueueStatus()
      if (statusRes.success && statusRes.status) {
        setQueueStatus(statusRes.status)
      }
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to clear queue' })
    }
    setProcessing(false)
  }

  const handleToggleWebhook = async (webhook: DiscordWebhook) => {
    const result = await toggleDiscordWebhook(webhook.id, !webhook.active)
    if (result.success) {
      setWebhooks(prev =>
        prev.map(w => (w.id === webhook.id ? { ...w, active: !w.active } : w))
      )
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to toggle webhook' })
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Delete this webhook subscription?')) return

    const result = await deleteDiscordWebhook(webhookId)
    if (result.success) {
      setWebhooks(prev => prev.filter(w => w.id !== webhookId))
      setMessage({ type: 'success', text: 'Webhook deleted' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to delete webhook' })
    }
  }

  return (
    <AppModal
      title="Discord Integration"
      subtitle="Manage Discord webhook notifications"
      onClose={onClose}
      size="lg"
      zIndex={70}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Close
        </button>
      }
    >
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-500/50 text-green-400'
              : 'bg-red-900/50 border border-red-500/50 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-t-2 border-indigo-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-2">Loading...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Master Enable Toggle */}
          <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Discord Integration</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Master switch for all Discord notifications
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('enabled')}
                disabled={saving}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  settings?.enabled ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    settings?.enabled ? 'left-8' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Event Type Toggles */}
          <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/30 space-y-3">
            <h3 className="text-white font-medium text-sm mb-3">Event Types</h3>
            
            <ToggleRow
              label="Orders"
              description="New orders, fulfillments, cancellations (Public)"
              enabled={settings?.orders_enabled ?? false}
              onToggle={() => handleToggleSetting('orders_enabled')}
              disabled={saving}
              color="green"
            />
            
            <ToggleRow
              label="Blueprints"
              description="Blueprint sync completions (Public)"
              enabled={settings?.blueprints_enabled ?? false}
              onToggle={() => handleToggleSetting('blueprints_enabled')}
              disabled={saving}
              color="orange"
            />
            
            <ToggleRow
              label="Support"
              description="New support tickets (Org Only)"
              enabled={settings?.support_enabled ?? false}
              onToggle={() => handleToggleSetting('support_enabled')}
              disabled={saving}
              color="blue"
              orgOnly
            />
            
            <ToggleRow
              label="Admin"
              description="Sync errors, system alerts (Org Only)"
              enabled={settings?.admin_enabled ?? false}
              onToggle={() => handleToggleSetting('admin_enabled')}
              disabled={saving}
              color="red"
              orgOnly
            />
          </div>

          {/* Official Org Webhook */}
          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 space-y-3">
            <div>
              <h3 className="text-white font-medium text-sm">Official Org Webhook</h3>
              <p className="text-xs text-slate-400 mt-1">
                This channel receives ALL events including org-only (support, admin)
              </p>
            </div>
            <input
              type="text"
              value={officialName}
              onChange={(e) => setOfficialName(e.target.value)}
              placeholder="Channel name (e.g., #bot-alerts)"
              className="w-full px-3 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 text-sm"
            />
            <input
              type="text"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full px-3 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 text-sm font-mono text-xs"
            />
            <button
              onClick={handleSaveOfficialWebhook}
              disabled={saving}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Official Webhook'}
            </button>
          </div>

          {/* Queue Status & Actions */}
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-medium text-sm">Message Queue</h3>
                {queueStatus && (
                  <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                    <p>Pending: {queueStatus.pending_count}</p>
                    <p>Processed today: {queueStatus.processed_today}</p>
                    {queueStatus.oldest_pending && (
                      <p>Oldest: {new Date(queueStatus.oldest_pending).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleProcessQueue}
                  disabled={processing || (queueStatus?.pending_count ?? 0) === 0}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? '...' : 'Process Now'}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleClearQueue(true)}
                disabled={processing}
                className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Clear Processed
              </button>
              <button
                onClick={() => handleClearQueue(false)}
                disabled={processing}
                className="flex-1 px-3 py-1.5 bg-red-600/50 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Registered Webhooks */}
          <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium text-sm">Registered Webhooks</h3>
              <span className="text-xs text-slate-500">{webhooks.length} total</span>
            </div>
            
            {webhooks.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No webhooks registered yet</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className={`p-2 rounded-lg border ${
                      webhook.active
                        ? 'border-slate-600 bg-slate-800/50'
                        : 'border-red-500/30 bg-red-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">
                          {webhook.webhook_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {webhook.subscribed_events.join(', ')}
                        </p>
                        <p className="text-xs text-slate-600">
                          {webhook.registered_by || 'Anonymous'} •{' '}
                          {new Date(webhook.created_at).toLocaleDateString()}
                          {webhook.failure_count > 0 && (
                            <span className="text-red-400 ml-2">
                              {webhook.failure_count} failures
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleWebhook(webhook)}
                          className={`px-2 py-1 text-xs rounded ${
                            webhook.active
                              ? 'bg-amber-600/50 hover:bg-amber-600 text-amber-200'
                              : 'bg-green-600/50 hover:bg-green-600 text-green-200'
                          }`}
                        >
                          {webhook.active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          className="px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 text-red-200 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppModal>
  )
}

interface ToggleRowProps {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
  color: 'green' | 'orange' | 'blue' | 'red'
  orgOnly?: boolean
}

function ToggleRow({ label, description, enabled, onToggle, disabled, color, orgOnly }: ToggleRowProps) {
  const colorClasses = {
    green: 'bg-green-600',
    orange: 'bg-orange-600',
    blue: 'bg-blue-600',
    red: 'bg-red-600',
  }

  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className="text-white text-sm">{label}</span>
        {orgOnly && (
          <span className="ml-2 px-1.5 py-0.5 bg-purple-900/50 text-purple-400 rounded text-xs">
            Org Only
          </span>
        )}
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          enabled ? colorClasses[color] : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            enabled ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}
