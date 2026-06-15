import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import {
  registerDiscordWebhook,
  getDiscordPublicEventTypes,
  getMyDiscordWebhooks,
  deleteMyDiscordWebhook,
  UserWebhook,
} from '../lib/discord'
import { useAuth } from '../contexts/AuthContext'

const MAX_WEBHOOKS = 4

const EVENT_LABELS: Record<string, string> = {
  order_new: 'New Orders',
  order_fulfilled: 'Accepted',
  order_cancelled: 'Cancelled',
  blueprints: 'Blueprint Syncs',
}

export default function DiscordSubscribeRoute() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  
  // Existing webhooks
  const [myWebhooks, setMyWebhooks] = useState<UserWebhook[]>([])
  const [loadingWebhooks, setLoadingWebhooks] = useState(true)
  
  // Registration form
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookName, setWebhookName] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['order_new', 'order_fulfilled', 'order_cancelled', 'blueprints'])
  const [availableEvents, setAvailableEvents] = useState<Array<{ event_type: string; enabled: boolean; display_name: string; description: string }>>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const userEmail = profile?.email || user?.email || ''

  // Redirect offline users
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/' })
    }
  }, [authLoading, user, navigate])

  // Fetch user's webhooks and available event types
  useEffect(() => {
    const fetchData = async () => {
      const [eventsResult, webhooksResult] = await Promise.all([
        getDiscordPublicEventTypes(),
        getMyDiscordWebhooks(),
      ])
      
      if (eventsResult.success && eventsResult.eventTypes) {
        setAvailableEvents(eventsResult.eventTypes)
      }
      
      if (webhooksResult.success && webhooksResult.webhooks) {
        setMyWebhooks(webhooksResult.webhooks)
      }
      
      setLoading(false)
      setLoadingWebhooks(false)
    }
    
    if (user) {
      fetchData()
    }
  }, [user])

  const handleToggleEvent = (eventType: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventType)
        ? prev.filter((e) => e !== eventType)
        : [...prev, eventType]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setSubmitting(true)

    const webhookRegex = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/
    if (!webhookRegex.test(webhookUrl)) {
      setError('Invalid Discord webhook URL format. It should look like: https://discord.com/api/webhooks/123456789/abcdef...')
      setSubmitting(false)
      return
    }

    if (!webhookName.trim()) {
      setError('Please enter a name for your webhook')
      setSubmitting(false)
      return
    }

    if (selectedEvents.length === 0) {
      setError('Please select at least one event type')
      setSubmitting(false)
      return
    }

    const result = await registerDiscordWebhook(
      webhookUrl,
      webhookName.trim(),
      selectedEvents,
      userEmail || undefined
    )

    if (result.success) {
      setSuccessMessage(`Successfully registered "${webhookName}"`)
      setWebhookUrl('')
      setWebhookName('')
      setSelectedEvents(['order_new', 'order_fulfilled', 'order_cancelled', 'blueprints'])
      
      // Refresh webhooks list
      const webhooksResult = await getMyDiscordWebhooks()
      if (webhooksResult.success && webhooksResult.webhooks) {
        setMyWebhooks(webhooksResult.webhooks)
      }
    } else {
      setError(result.error || 'Failed to register webhook')
    }
    setSubmitting(false)
  }

  const handleDelete = async (webhook: UserWebhook) => {
    if (!confirm(`Delete webhook "${webhook.webhook_name}"? This cannot be undone.`)) {
      return
    }
    
    setDeleting(webhook.id)
    setError(null)
    setSuccessMessage(null)
    
    const result = await deleteMyDiscordWebhook(webhook.id)
    
    if (result.success) {
      setMyWebhooks((prev) => prev.filter((w) => w.id !== webhook.id))
      setSuccessMessage(`Deleted "${webhook.webhook_name}"`)
    } else {
      setError(result.error || 'Failed to delete webhook')
    }
    
    setDeleting(null)
  }

  // Loading state
  if (authLoading) {
    return (
      <FeaturePageLayout title="Webhooks" subtitle="Loading..." badge="Discord">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
        </div>
      </FeaturePageLayout>
    )
  }

  if (!user) {
    return null
  }

  const canAddMore = myWebhooks.length < MAX_WEBHOOKS

  return (
    <FeaturePageLayout
      title="Webhooks"
      subtitle="Subscribe your Discord channels to Dumper's Repo updates"
      badge="Discord"
    >
      <div className="max-w-2xl space-y-6">
        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-green-950/40 border border-green-500/30 rounded-lg text-sm text-green-300">
            {successMessage}
          </div>
        )}

        {/* Existing Webhooks */}
        <section className="p-4 rounded-xl border border-slate-700 bg-slate-800/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Your Webhooks</h2>
            <span className={`text-xs px-2 py-1 rounded ${
              myWebhooks.length >= MAX_WEBHOOKS 
                ? 'bg-red-900/50 text-red-400' 
                : 'bg-slate-700 text-slate-400'
            }`}>
              {myWebhooks.length} / {MAX_WEBHOOKS}
            </span>
          </div>

          {loadingWebhooks ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : myWebhooks.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              You haven't registered any webhooks yet.
            </p>
          ) : (
            <div className="space-y-3">
              {myWebhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className={`p-3 rounded-lg border ${
                    webhook.active
                      ? 'border-slate-600 bg-slate-800/50'
                      : 'border-red-500/30 bg-red-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium truncate">
                          {webhook.webhook_name}
                        </p>
                        {!webhook.active && (
                          <span className="px-1.5 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {webhook.subscribed_events.map((event) => (
                          <span
                            key={event}
                            className="px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 text-xs rounded"
                          >
                            {EVENT_LABELS[event] || event}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        Registered {new Date(webhook.created_at).toLocaleDateString()}
                        {webhook.last_success_at && (
                          <span className="text-green-400 ml-2">
                            Last sent: {new Date(webhook.last_success_at).toLocaleDateString()}
                          </span>
                        )}
                        {webhook.failure_count > 0 && (
                          <span className="text-red-400 ml-2">
                            {webhook.failure_count} failure{webhook.failure_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(webhook)}
                      disabled={deleting === webhook.id}
                      className="px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 text-red-200 rounded transition-colors disabled:opacity-50"
                    >
                      {deleting === webhook.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Registration Form */}
        {canAddMore ? (
          <section className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20">
            <h2 className="text-white font-semibold mb-4">Register New Webhook</h2>

            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">
                <strong className="text-slate-300">To create a webhook:</strong>
              </p>
              <ol className="text-xs text-slate-500 list-decimal list-inside space-y-0.5">
                <li>Go to your Discord server settings</li>
                <li>Click "Integrations" → "Webhooks"</li>
                <li>Click "New Webhook"</li>
                <li>Choose a channel and copy the webhook URL</li>
              </ol>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-t-2 border-indigo-500 rounded-full animate-spin mx-auto"></div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Webhook URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Channel Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    placeholder="e.g., #dumpers-updates"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Event Types
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableEvents.map((event) => (
                      <label
                        key={event.event_type}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                          !event.enabled
                            ? 'opacity-50 cursor-not-allowed border-slate-700 bg-slate-800/30'
                            : selectedEvents.includes(event.event_type)
                            ? 'border-indigo-500/50 bg-indigo-950/30'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event.event_type)}
                          onChange={() => handleToggleEvent(event.event_type)}
                          disabled={!event.enabled}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/20"
                        />
                        <div>
                          <span className="text-white">{event.display_name}</span>
                          {!event.enabled && (
                            <span className="text-amber-400 text-xs ml-1">(disabled)</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Webhook'}
                </button>
              </form>
            )}
          </section>
        ) : (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20">
            <p className="text-amber-300 text-sm">
              You've reached the maximum of {MAX_WEBHOOKS} webhooks. Delete one to add another.
            </p>
          </div>
        )}

        <div className="pt-2">
          <Link
            to="/"
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            ← Back to Blueprints
          </Link>
        </div>
      </div>
    </FeaturePageLayout>
  )
}
