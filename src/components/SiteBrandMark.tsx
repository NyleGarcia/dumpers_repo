import React from 'react'
import { Link } from '@tanstack/react-router'

type SiteBrandMarkSize = 'sm' | 'md' | 'lg'

interface SiteBrandMarkProps {
  size?: SiteBrandMarkSize
  className?: string
}

const sizePx: Record<SiteBrandMarkSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
}

/** Inline SVG — stays sharp at header sizes (PNG favicon is soft when scaled). */
function DrMarkIcon({ px }: { px: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={px}
      height={px}
      role="img"
      aria-hidden
      className="block"
    >
      <defs>
        <linearGradient id="drMarkGrad" x1="72" y1="256" x2="440" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="45%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
        <filter id="drMarkGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="512" height="512" rx="88" fill="#0f172a" />
      <g fill="url(#drMarkGrad)" filter="url(#drMarkGlow)">
        <path d="M108 148h60v66h-60zM108 298h60v66h-60z" />
        <path d="M168 148h56l28 28v44l-28 28h-56V244h48l16-16v-32l-16-16H168V148z" />
        <path d="M168 268h56l28 28v40l-28 28h-56V340h48l16-16v-12l-16-16H168V268z" />
        <path d="M276 148v216h60v-64l36 64h72l-72-96 60-120h-60l-36 72V148h-60z" />
        <path d="M336 176h48l20-28h-68v28z" />
      </g>
    </svg>
  )
}

export default function SiteBrandMark({ size = 'md', className = '' }: SiteBrandMarkProps) {
  const px = sizePx[size]

  return (
    <Link
      to="/"
      title="Dumper's Repo — home"
      className={`shrink-0 rounded-xl hover:brightness-110 transition-[filter] ${className}`}
    >
      <DrMarkIcon px={px} />
    </Link>
  )
}
