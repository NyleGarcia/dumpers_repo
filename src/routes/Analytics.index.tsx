import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import FeaturePageLayout from '../components/layout/FeaturePageLayout'
import {
  ANALYTICS_SUB_TOOL_LABELS,
  ANALYTICS_TOOL_LABELS,
  formatAnalyticsDuration,
} from '../lib/analytics'

type DailyVisitorRow = {
  date: string
  count: number
}

type ToolUsageRow = {
  tool_id: string
  sub_tool_id: string
  unique_visitors: number
  total_seconds: number
  avg_seconds: number
}

type AnalyticsSummary = {
  period_days: number
  dau_today: number
  wau: number
  mau: number
  guest_mau: number
  signed_in_mau: number
  daily_visitors: DailyVisitorRow[]
  tool_usage: ToolUsageRow[]
}

const PERIOD_OPTIONS = [7, 30, 90] as const

function formatToolLabel(toolId: string, subToolId: string): string {
  const tool = ANALYTICS_TOOL_LABELS[toolId] ?? toolId
  if (!subToolId) return tool
  const sub = ANALYTICS_SUB_TOOL_LABELS[subToolId] ?? subToolId
  return `${tool} · ${sub}`
}

export default function AnalyticsRoute() {
  const { isSuperAdmin } = useAuth()
  const [periodDays, setPeriodDays] = useState<number>(30)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase.rpc('get_site_analytics_summary', {
        p_days: periodDays,
      })
      if (fetchError) throw fetchError
      setSummary(data as AnalyticsSummary)
    } catch (err) {
      setSummary(null)
      setError((err as Error).message)
    }

    setLoading(false)
  }, [periodDays])

  useEffect(() => {
    if (isSuperAdmin) void loadSummary()
  }, [isSuperAdmin, loadSummary])

  const maxDailyCount = useMemo(() => {
    if (!summary?.daily_visitors?.length) return 1
    return Math.max(...summary.daily_visitors.map((row) => row.count), 1)
  }, [summary])

  if (!isSuperAdmin) {
    return (
      <FeaturePageLayout title="Site Analytics" subtitle="Super-admin access required">
        <p className="text-slate-400">You do not have permission to view site analytics.</p>
      </FeaturePageLayout>
    )
  }

  return (
    <FeaturePageLayout
      title="Site Analytics"
      subtitle="Unique visitors and active time per tool (includes guests in Offline Mode)"
      actions={
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPeriodDays(days)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                periodDays === days
                  ? 'site-filter-selected-orange border-orange-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white'
              }`}
            >
              {days}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg"
          >
            Refresh
          </button>
        </div>
      }
    >
      {loading && (
        <p className="text-slate-400 py-8 text-center">Loading analytics…</p>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm">
          {error}
          {error.includes('get_site_analytics_summary') && (
            <p className="mt-2 text-red-200/80">
              Run migration <code className="text-red-100">102_site_analytics.sql</code> in Supabase first.
            </p>
          )}
        </div>
      )}

      {!loading && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Today (DAU)" value={summary.dau_today} />
            <StatCard label="Last 7 days (WAU)" value={summary.wau} />
            <StatCard label="Last 30 days (MAU)" value={summary.mau} />
            <StatCard label="Guest MAU" value={summary.guest_mau} />
            <StatCard label="Signed-in MAU" value={summary.signed_in_mau} />
          </div>

          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">
              Daily unique visitors ({summary.period_days} days)
            </h2>
            {summary.daily_visitors.length === 0 ? (
              <p className="text-sm text-slate-500">No visitor data yet.</p>
            ) : (
              <div className="space-y-2">
                {summary.daily_visitors.map((row) => (
                  <div key={row.date} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-slate-500 tabular-nums">{row.date}</span>
                    <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-orange-500/70 rounded"
                        style={{ width: `${Math.max(4, (row.count / maxDailyCount) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-slate-300 tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200">Tool usage & active time</h2>
              <p className="text-xs text-slate-500 mt-1">
                Active time counts only while the tab is visible. Ghost Mode sessions are excluded.
              </p>
            </div>
            {summary.tool_usage.length === 0 ? (
              <p className="text-sm text-slate-500 p-4">No tool usage recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-700">
                      <th className="px-4 py-2 font-medium">Tool</th>
                      <th className="px-4 py-2 font-medium text-right">Unique visitors</th>
                      <th className="px-4 py-2 font-medium text-right">Total active time</th>
                      <th className="px-4 py-2 font-medium text-right">Avg per visitor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.tool_usage.map((row) => (
                      <tr key={`${row.tool_id}:${row.sub_tool_id}`} className="border-b border-slate-800/80">
                        <td className="px-4 py-2.5 text-slate-200">
                          {formatToolLabel(row.tool_id, row.sub_tool_id)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">
                          {row.unique_visitors}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">
                          {formatAnalyticsDuration(row.total_seconds)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">
                          {formatAnalyticsDuration(Number(row.avg_seconds))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-slate-500">
            Visitors are identified by an anonymous ID stored in the browser. Signed-in members may be linked to the same ID.
          </p>
        </div>
      )}
    </FeaturePageLayout>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
      <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1 tabular-nums">{value.toLocaleString()}</p>
    </div>
  )
}
