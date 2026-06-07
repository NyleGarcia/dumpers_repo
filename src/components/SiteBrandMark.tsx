import React from 'react'
import { Link } from '@tanstack/react-router'
import { SITE_BRAND_LOGO } from '../config/site'

type SiteBrandMarkSize = 'sm' | 'md' | 'lg'

interface SiteBrandMarkProps {
  size?: SiteBrandMarkSize
  className?: string
}

const sizeClasses: Record<SiteBrandMarkSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

export default function SiteBrandMark({ size = 'md', className = '' }: SiteBrandMarkProps) {
  return (
    <Link
      to="/"
      title="Dumper's Repo — home"
      className={`shrink-0 rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950/80 shadow-md hover:border-orange-500/40 transition-colors ${className}`}
    >
      <img
        src={SITE_BRAND_LOGO}
        alt="Dumper's Repo"
        className={`${sizeClasses[size]} object-cover`}
      />
    </Link>
  )
}
