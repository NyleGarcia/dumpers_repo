import React, { useState } from 'react'
import { wipeResourceTracker } from '../lib/operations'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

export default function DbActionsModal({ onClose }: { onClose: () => void }) {
  useBodyScrollLock()
  const [confirmText, setConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleWipe = async () => {
    if (confirmText !== 'WIPE') return

    setWiping(true)
    setMessage(null)

    const result = await wipeResourceTracker()

    setWiping(false)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }

    setMessage({
      type: 'success',
      text: `Wiped ${result.deletedCount ?? 0} personal stock row(s).`,
    })
    setConfirmText('')
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">DB Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Super-admin database operations</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-900/50 border border-green-500/50 text-green-400'
                  : 'bg-red-900/50 border border-red-500/50 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 space-y-3">
            <div>
              <h3 className="text-white font-medium">Resource Tracker Wipe</h3>
              <p className="text-sm text-slate-400 mt-1">
                Deletes all rows from personal resource inventory. Site Total will read empty until
                members re-enter stock. This cannot be undone.
              </p>
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type WIPE to confirm"
              className="w-full px-4 py-2.5 bg-slate-800 border border-red-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleWipe()}
              disabled={wiping || confirmText !== 'WIPE'}
              className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {wiping ? 'Wiping...' : 'Wipe all personal stock'}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 shrink-0">
          <button
            type="button"
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
