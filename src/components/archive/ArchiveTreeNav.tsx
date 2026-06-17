import React from 'react'
import type { ArchiveSection } from '../../routes/Archive.index'

interface ArchiveTreeNavProps {
  currentSection: ArchiveSection
  onSelectSection: (section: ArchiveSection) => void
}

interface NavItem {
  id: ArchiveSection
  label: string
  description: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    description: 'Overview & quick links',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'mining',
    label: 'Mining Guide',
    description: 'Ore locations & rarity',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'components',
    label: 'Components',
    description: 'Ship parts database',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'ordnance',
    label: 'Ordnance',
    description: 'Missiles & torpedoes',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'factions',
    label: 'Factions',
    description: 'Standing & reputation',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'lore',
    label: 'Resource Lore',
    description: 'Commodity flavor text',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'general',
    label: 'General Archive',
    description: 'Misc reference info',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
]

export default function ArchiveTreeNav({ currentSection, onSelectSection }: ArchiveTreeNavProps) {
  return (
    <nav className="px-3 lg:px-0" aria-label="Archive sections">
      <h2 className="sr-only">Archive Navigation</h2>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = currentSection === item.id
          return (
            <li key={item.id}>
              <button
                onClick={() => onSelectSection(item.id)}
                className={`
                  w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                  ${isActive
                    ? 'bg-orange-600/20 border border-orange-500/40 shadow-sm shadow-orange-500/10'
                    : 'hover:bg-slate-800/60 border border-transparent'
                  }
                `}
              >
                <span className={`mt-0.5 ${isActive ? 'text-orange-400' : 'text-slate-500'}`}>
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <span className={`block text-sm font-medium ${isActive ? 'text-orange-200' : 'text-slate-300'}`}>
                    {item.label}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {item.description}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
