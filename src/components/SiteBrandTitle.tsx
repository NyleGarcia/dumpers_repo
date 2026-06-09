import React from 'react'
import { SITE_BRAND_FONT, SITE_BRAND_REPO_GRADIENT } from '../config/site'

type SiteBrandTitleSize = 'hero' | 'page' | 'compact'

interface SiteBrandTitleProps {
  size?: SiteBrandTitleSize
  layout?: 'stacked' | 'inline'
  align?: 'center' | 'left'
  slogan?: string
  subtitle?: React.ReactNode
  /** Header chrome — skip glow that blurs at small sizes */
  subtle?: boolean
  className?: string
}

const titleSizeClasses: Record<SiteBrandTitleSize, string> = {
  hero: 'text-4xl md:text-5xl lg:text-6xl',
  page: 'text-3xl md:text-4xl lg:text-5xl',
  compact: 'text-base sm:text-lg',
}

const sloganSizeClasses: Record<SiteBrandTitleSize, string> = {
  hero: 'text-xs sm:text-sm',
  page: 'text-xs sm:text-sm',
}

const brandLineStyle = { fontFamily: SITE_BRAND_FONT } as const

const repoLineStyle = {
  fontFamily: SITE_BRAND_FONT,
  background: SITE_BRAND_REPO_GRADIENT,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 18px rgba(249, 115, 22, 0.35))',
} as const

export default function SiteBrandTitle({
  size = 'page',
  layout = 'inline',
  align = 'center',
  slogan,
  subtitle,
  subtle = false,
  className = '',
}: SiteBrandTitleProps) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left'
  const titleSize = titleSizeClasses[size]
  const isStacked = layout === 'stacked'
  const truncate = className.includes('truncate')
  const repoStyle = subtle
    ? {
        fontFamily: SITE_BRAND_FONT,
        background: SITE_BRAND_REPO_GRADIENT,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }
    : repoLineStyle

  return (
    <div className={`${alignClass} min-w-0 ${truncate ? 'overflow-hidden' : ''} ${className}`}>
      <h1
        className={`font-black uppercase tracking-wide ${isStacked ? 'leading-none' : 'leading-tight'} ${titleSize} ${truncate ? 'truncate whitespace-nowrap' : ''}`}
      >
        <span className={`text-white ${isStacked ? 'block' : ''}`} style={brandLineStyle}>
          Dumper&apos;s
        </span>
        <span className={isStacked ? 'block' : ''} style={repoStyle}>
          {isStacked ? 'Repo' : ' Repo'}
        </span>
      </h1>
      {slogan && (
        <p
          className={`mt-3 text-slate-400 uppercase font-medium ${sloganSizeClasses[size]}`}
          style={{ fontFamily: SITE_BRAND_FONT, letterSpacing: '0.35em' }}
        >
          {slogan}
        </p>
      )}
      {subtitle && <div className="mt-2 text-slate-400 text-sm">{subtitle}</div>}
    </div>
  )
}
