import React from 'react'

/** Black Star org graphic — card flip back face (transparent PNG, aspect ratio preserved). */
const BLACKSTAR_LOGO = '/blackstar.png'

export default function BrandModalBack({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center p-6 bg-slate-900 border border-slate-700 rounded-2xl ${className}`}
    >
      <img
        src={BLACKSTAR_LOGO}
        alt="Black Star"
        className="max-w-[min(75%,220px)] max-h-[min(65%,180px)] w-auto h-auto object-contain drop-shadow-lg"
        draggable={false}
      />
    </div>
  )
}
