import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getOrgLogoCandidates, ORG_LOGO_DEFAULT_PATH, preloadOrgLogoCandidates } from '../lib/orgLogo'

export default function BrandModalBack({ className = '' }: { className?: string }) {
  const { orgLogoUpdatedAt } = useAuth()
  const candidates = useMemo(
    () => getOrgLogoCandidates(orgLogoUpdatedAt),
    [orgLogoUpdatedAt]
  )
  const [candidateIndex, setCandidateIndex] = useState(0)
  const src = candidates[candidateIndex] ?? ORG_LOGO_DEFAULT_PATH

  useEffect(() => {
    preloadOrgLogoCandidates(orgLogoUpdatedAt)
  }, [orgLogoUpdatedAt])

  useEffect(() => {
    setCandidateIndex(0)
  }, [orgLogoUpdatedAt])

  const handleImageError = () => {
    setCandidateIndex((index) => {
      if (index + 1 < candidates.length) return index + 1
      return index
    })
  }

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden ${className}`}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        draggable={false}
        onError={handleImageError}
        className="block max-w-[78%] max-h-[78%] w-auto h-auto object-contain object-center mx-auto my-auto"
      />
    </div>
  )
}
