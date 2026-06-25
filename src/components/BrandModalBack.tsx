import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { preloadOrgLogo } from '../lib/orgLogo'

export default function BrandModalBack({ className = '' }: { className?: string }) {
  const { orgLogoUrl } = useAuth()
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    preloadOrgLogo(orgLogoUrl)
  }, [orgLogoUrl])

  useEffect(() => {
    setImageFailed(false)
  }, [orgLogoUrl])

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden ${className}`}
    >
      {orgLogoUrl && !imageFailed ? (
        <img
          src={orgLogoUrl}
          alt=""
          aria-hidden
          decoding="sync"
          loading="eager"
          fetchPriority="high"
          draggable={false}
          onError={() => setImageFailed(true)}
          className="block max-w-[78%] max-h-[78%] w-auto h-auto object-contain object-center mx-auto my-auto"
        />
      ) : (
        <div className="text-center px-6 text-slate-500 text-xs leading-relaxed max-w-[85%]">
          <p className="font-medium text-slate-400 mb-1">Org logo</p>
          <p>Super-admins can upload a PNG in Settings → Site.</p>
        </div>
      )}
    </div>
  )
}
