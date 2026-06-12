import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import AppModal from './layout/AppModal'

type ResolvedBy = 'officer' | 'member'

interface Props {
  ticketId: string
  ticketSubject: string
  resolvedBy: ResolvedBy
  resolutionMessage: string | null
  onClose: () => void
  onComplete: () => void
}

const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent']

export default function OfficerRatingModal({
  ticketId,
  ticketSubject,
  resolvedBy,
  resolutionMessage,
  onClose,
  onComplete,
}: Props) {
  const [stars, setStars] = useState<number>(0)
  const [hoveredStars, setHoveredStars] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [wantToEscalate, setWantToEscalate] = useState(false)
  const [escalationReason, setEscalationReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEscalate = resolvedBy === 'officer' && stars > 0 && stars < 3
  const displayStars = hoveredStars || stars

  const handleSubmit = async () => {
    if (stars === 0) {
      setError('Please select a rating')
      return
    }

    if (wantToEscalate && !escalationReason.trim()) {
      setError('Please provide a reason for escalation')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('rate_officer_and_close', {
        p_ticket_id: ticketId,
        p_stars: stars,
        p_comment: comment.trim() || null,
        p_escalate: wantToEscalate,
        p_escalation_reason: wantToEscalate ? escalationReason.trim() : null,
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        onComplete()
      } else {
        throw new Error(data?.error || 'Failed to submit rating')
      }
    } catch (err) {
      setError((err as Error).message)
    }

    setSubmitting(false)
  }

  return (
    <AppModal
      title="Rate Your Support Experience"
      subtitle={ticketSubject}
      onClose={onClose}
      size="md"
      zIndex={80}
    >
      <div className="space-y-6">
        {resolutionMessage && (
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Resolution message:</p>
            <p className="text-sm text-slate-300">{resolutionMessage}</p>
          </div>
        )}

        {resolvedBy === 'member' && (
          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              You marked this ticket as resolved. Please rate how well the officer handled your request.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-300 mb-3 text-center">
            How would you rate the support you received?
          </label>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => {
                  setStars(rating)
                  if (rating >= 3) setWantToEscalate(false)
                }}
                onMouseEnter={() => setHoveredStars(rating)}
                onMouseLeave={() => setHoveredStars(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <svg
                  className={`w-10 h-10 transition-colors ${
                    rating <= displayStars
                      ? 'text-amber-400'
                      : 'text-slate-600'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          {displayStars > 0 && (
            <p className={`text-center mt-2 text-sm font-medium ${
              displayStars >= 4 ? 'text-green-400' :
              displayStars >= 3 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {STAR_LABELS[displayStars - 1]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-2">
            Comments (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share any feedback about your experience..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 resize-none text-sm"
          />
        </div>

        {canEscalate && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wantToEscalate}
                onChange={(e) => setWantToEscalate(e.target.checked)}
                className="mt-1 rounded border-slate-500 bg-slate-800 text-red-500 focus:ring-red-500/40"
              />
              <div>
                <span className="text-sm font-medium text-red-300">
                  Escalate to Super-Admin
                </span>
                <p className="text-xs text-red-300/70 mt-0.5">
                  If you feel your issue wasn&apos;t properly resolved, you can request a review by a super-admin.
                </p>
              </div>
            </label>

            {wantToEscalate && (
              <div>
                <label className="block text-sm text-red-300 mb-2">
                  Why are you escalating? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="Explain why you believe this ticket needs further review..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-red-500/40 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none text-sm"
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || stars === 0}
            className={`flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              wantToEscalate
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {submitting
              ? 'Submitting...'
              : wantToEscalate
              ? 'Submit & Escalate'
              : 'Submit Rating'}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
