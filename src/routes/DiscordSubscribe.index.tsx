import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import {
  registerDiscordWebhook,
  getDiscordPublicEventTypes,
} from '../lib/discord'
import { useAuth } from '../contexts/AuthContext'

export default function DiscordSubscribeRoute() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookName, setWebhookName] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['orders', 'blueprints'])
  const [availableEvents, setAvailableEvents] = useState<Array<{ event_type: string; enabled: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get user email for registration
  const userEmail = profile?.email || user?.email || ''

  // Redirect offline users to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/' })
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    const fetchEventTypes = async () => {
      const result = await getDiscordPublicEventTypes()
      if (result.success && result.eventTypes) {
        setAvailableEvents(result.eventTypes)
      }
      setLoading(false)
    }
    fetchEventTypes()
  }, [])

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
    setSubmitting(true)

    // Validate webhook URL format
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
      setSuccess(true)
    } else {
      setError(result.error || 'Failed to register webhook')
    }
    setSubmitting(false)
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <FeaturePageLayout
        title="Webhooks"
        subtitle="Loading..."
        badge="Discord"
      >
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
        </div>
      </FeaturePageLayout>
    )
  }

  // Don't render form for unauthenticated users (redirect handles it)
  if (!user) {
    return null
  }

  if (success) {
    return (
      <FeaturePageLayout
        title="Webhook Registered!"
        subtitle="Your Discord channel will now receive notifications"
        badge="Success"
      >
        <div className="max-w-xl space-y-6">
          <div className="p-4 bg-green-950/40 rounded-xl border border-green-500/30">
            <h2 className="text-sm font-semibold text-green-300 mb-2">
              Registration Complete
            </h2>
            <p className="text-sm text-green-200/90">
              Your Discord channel <strong>{webhookName}</strong> has been registered
              to receive {selectedEvents.join(' and ')} notifications from Dumper's Repo.
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/80">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">What happens next?</h3>
            <ul className="text-sm text-slate-400 space-y-1.5">
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span>When events occur, notifications will be sent to your channel</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span>Webhooks that fail repeatedly will be auto-disabled</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span>To unsubscribe, delete the webhook in your Discord server settings</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setSuccess(false)
                setWebhookUrl('')
                setWebhookName('')
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Register Another
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors"
            >
              Back to Blueprints
            </Link>
          </div>
        </div>
      </FeaturePageLayout>
    )
  }

  return (
    <FeaturePageLayout
      title="Webhooks"
      subtitle="Subscribe your Discord channel to Dumper's Repo updates"
      badge="Discord"
    >
      <div className="max-w-xl space-y-6">
        <div className="p-4 bg-indigo-950/40 rounded-xl border border-indigo-500/30">
          <h2 className="text-sm font-semibold text-indigo-300 mb-2">
            How it works
          </h2>
          <p className="text-sm text-indigo-200/90 mb-3">
            Create a webhook in your Discord server and paste the URL below. Your channel
            will receive notifications about orders and blueprint updates.
          </p>
          <div className="text-xs text-indigo-300/80 space-y-1">
            <p><strong>To create a webhook:</strong></p>
            <ol className="list-decimal list-inside space-y-0.5 text-indigo-300/70">
              <li>Go to your Discord server settings</li>
              <li>Click "Integrations" → "Webhooks"</li>
              <li>Click "New Webhook"</li>
              <li>Choose a channel and copy the webhook URL</li>
            </ol>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-t-2 border-indigo-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 mt-2">Loading...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-300">
                {error}
              </div>
            )}

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
              <div className="space-y-2">
                {availableEvents.map((event) => (
                  <label
                    key={event.event_type}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
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
                      <span className="text-sm text-white capitalize">
                        {event.event_type}
                      </span>
                      <p className="text-xs text-slate-500">
                        {event.event_type === 'orders' && 'New orders, fulfillments, cancellations'}
                        {event.event_type === 'blueprints' && 'Blueprint data sync completions'}
                      </p>
                      {!event.enabled && (
                        <span className="text-xs text-amber-400">Currently disabled</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Registering...' : 'Register Webhook'}
              </button>
            </div>
          </form>
        )}

        <div className="pt-4">
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
