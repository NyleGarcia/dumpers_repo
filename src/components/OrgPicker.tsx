import React, { useEffect, useState } from 'react'
import {
  isDumpersOrg,
  joinDumpersOrganization,
  joinOrganization,
  searchJoinableOrganizations,
  type JoinableOrganization,
} from '../lib/org'

interface OrgPickerProps {
  onJoined: () => void | Promise<void>
}

export default function OrgPicker({ onJoined }: OrgPickerProps) {
  const [query, setQuery] = useState('')
  const [orgs, setOrgs] = useState<JoinableOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)
      const result = await searchJoinableOrganizations(query)
      if (cancelled) return
      if (result.error) setError(result.error)
      setOrgs(result.data)
      setLoading(false)
    }

    const timer = window.setTimeout(() => void run(), query ? 250 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const handleJoin = async (org: JoinableOrganization) => {
    setJoiningId(org.id)
    setError(null)

    const result = isDumpersOrg(org)
      ? await joinDumpersOrganization()
      : await joinOrganization(org.id)

    if (result.error) {
      setError(result.error)
      setJoiningId(null)
      return
    }

    await onJoined()
    setJoiningId(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Choose one organization on the site. Org stock stays hidden until an officer verifies your
        membership. Personal stock is never shared across orgs. No org yet?{' '}
        <strong className="text-amber-300/90">Dumpers Repo</strong> is the open default org.
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search organizations..."
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 text-sm"
      />

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-slate-700 divide-y divide-slate-800">
        {loading ? (
          <p className="px-3 py-4 text-sm text-slate-500 text-center">Searching...</p>
        ) : orgs.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500 text-center">No organizations found.</p>
        ) : (
          orgs.map((org) => (
            <div
              key={org.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-900/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{org.name}</p>
                <p className="text-xs text-slate-500">
                  {org.resources_public ? 'Public org stock' : 'Private org stock'}
                  {isDumpersOrg(org) && ' · default open org'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleJoin(org)}
                disabled={joiningId === org.id}
                className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                  isDumpersOrg(org)
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                {joiningId === org.id ? 'Joining...' : isDumpersOrg(org) ? 'Join Dumpers' : 'Join'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
