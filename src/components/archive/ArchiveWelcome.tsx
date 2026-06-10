import React from 'react'
import type { ArchiveSection } from '../../routes/Archive.index'

interface QuickLink {
  id: string
  label: string
  description: string
  section: ArchiveSection
}

interface ArchiveWelcomeProps {
  onNavigate?: (section: ArchiveSection) => void
}

const QUICK_LINKS: QuickLink[] = [
  {
    id: 'mining',
    label: 'Mining Guide',
    description: 'Find ore locations by rarity tier, discover which moons and asteroids yield the best resources.',
    section: 'mining',
  },
  {
    id: 'components',
    label: 'Component Database',
    description: 'Browse ship components by type, size, grade, and manufacturer. Find the perfect upgrade.',
    section: 'components',
  },
  {
    id: 'ordnance',
    label: 'Ordnance Reference',
    description: 'Compare missiles and torpedoes by size, guidance type, and manufacturer.',
    section: 'ordnance',
  },
  {
    id: 'factions',
    label: 'Faction Reference',
    description: 'Understand reputation systems, standing tiers, and how they affect blueprint rewards.',
    section: 'factions',
  },
  {
    id: 'general',
    label: 'General Archive',
    description: 'Miscellaneous reference information and helpful links.',
    section: 'general',
  },
]

export default function ArchiveWelcome({ onNavigate }: ArchiveWelcomeProps) {
  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="text-center pb-6 border-b border-slate-800/60">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-600/20 border border-orange-500/30 mb-4">
          <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Welcome to the Information Archive</h2>
        <p className="text-slate-400 max-w-lg mx-auto">
          Your comprehensive reference for Star Citizen data. Browse mining locations, ship components,
          ordnance specs, faction standings, and more.
        </p>
      </div>

      {/* Quick links grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Quick Navigation
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <QuickLinkCard key={link.id} {...link} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Data source info */}
      <div className="mt-8 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-slate-300">Data Sources</h4>
            <p className="text-xs text-slate-500 mt-1">
              Information is sourced from MrKraken's StarStrings community data, the Star Citizen Wiki API,
              and scunpacked game files. Data is synchronized periodically by site administrators.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface QuickLinkCardProps {
  label: string
  description: string
  section: ArchiveSection
  onNavigate?: (section: ArchiveSection) => void
}

function QuickLinkCard({ label, description, section, onNavigate }: QuickLinkCardProps) {
  const handleClick = () => {
    if (onNavigate) {
      onNavigate(section)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="group text-left p-4 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-orange-500/30 hover:bg-slate-800/60 transition-all"
    >
      <h4 className="text-sm font-medium text-slate-200 group-hover:text-orange-300 transition-colors">
        {label}
      </h4>
      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{description}</p>
      <span className="inline-flex items-center gap-1 mt-2 text-xs text-orange-400/70 group-hover:text-orange-400 transition-colors">
        Browse
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )
}
