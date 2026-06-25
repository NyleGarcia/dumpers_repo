import React, { useEffect } from 'react'
import { preloadBlackstarLogo } from '../lib/preloadBlackstarLogo'

/** Black Star org graphic — card flip back face (transparent PNG, aspect ratio preserved). */
const BLACKSTAR_LOGO = '/blackstar.png'

export default function BrandModalBack({ className = '' }: { className?: string }) {
  useEffect(() => {
    preloadBlackstarLogo()
  }, [])

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden ${className}`}
    >
      <img
        src={BLACKSTAR_LOGO}
        alt=""
        aria-hidden
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        draggable={false}
        className="block max-w-[78%] max-h-[78%] w-auto h-auto object-contain object-center mx-auto my-auto"
      />
    </div>
  )
}
