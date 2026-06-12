import React from 'react'

interface LinkItem {
  title: string
  description: string
  url: string
  icon: React.ReactNode
}

const EXTERNAL_LINKS: LinkItem[] = [
  {
    title: 'Star Citizen Wiki',
    description: 'Community wiki with comprehensive game information',
    url: 'https://starcitizen.tools',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Erkul Games',
    description: 'DPS calculator and ship loadout planner',
    url: 'https://www.erkul.games',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Universal Item Finder',
    description: 'Search for in-game items and their locations',
    url: 'https://finder.cstone.space',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: 'Cornerstone',
    description: 'Trading and economy tracker',
    url: 'https://cstone.space',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: 'Star Citizen Trade Tools',
    description: 'Mining and trading calculators',
    url: 'https://sc-trade.tools',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: 'RSI Website',
    description: 'Official Star Citizen website',
    url: 'https://robertsspaceindustries.com',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

const TIPS: { title: string; content: string }[] = [
  {
    title: 'Blueprint Rewards',
    content: 'Blueprints are awarded from contracts at specific reputation levels. Check Mission Tracker to track which blueprints you\'re working towards and the missions that can award them.',
  },
  {
    title: 'Resource Tracking',
    content: 'Use the Resource Tracker to keep inventory of your mined and refined materials. The DFP (Dumper\'s Fair Price) algorithm calculates fair market values based on quality tiers.',
  },
  {
    title: 'Quality Tiers',
    content: 'Resource quality ranges from 500 (base) to 1000 (perfect). Higher quality resources have exponentially higher DFP values, especially at Q850 and above.',
  },
  {
    title: 'Standing Progression',
    content: 'All factions use the same standing ladder from Neutral to Elite Contractor. Higher standings unlock better-paying contracts and exclusive blueprint rewards.',
  },
]

export default function GeneralArchiveSection() {
  return (
    <div className="space-y-8">
      {/* Quick tips */}
      <section>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Quick Tips
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPS.map((tip) => (
            <div
              key={tip.title}
              className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50"
            >
              <h4 className="text-sm font-medium text-orange-300 mb-1">{tip.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{tip.content}</p>
            </div>
          ))}
        </div>
      </section>

      {/* External resources */}
      <section>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          External Resources
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.title}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-orange-500/30 hover:bg-slate-800/60 transition-all"
            >
              <div className="shrink-0 p-2 rounded-lg bg-slate-700/50 text-slate-400 group-hover:text-orange-400 transition-colors">
                {link.icon}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-slate-200 group-hover:text-orange-300 transition-colors flex items-center gap-1">
                  {link.title}
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{link.description}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Data attribution */}
      <section className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Data Sources & Attribution</h3>
        <ul className="space-y-2 text-xs text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">•</span>
            <span>
              <strong className="text-slate-300">MrKraken's StarStrings</strong> - Community-curated localization and mission data
              extracted from game files. Used for mining locations, components, ordnance, and blueprint-to-standing mappings.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">•</span>
            <span>
              <strong className="text-slate-300">Star Citizen Wiki API</strong> - Official community wiki API for blueprint metadata,
              component information, and game data.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">•</span>
            <span>
              <strong className="text-slate-300">scunpacked-data</strong> - Pre-extracted game data repository used for
              contract/mission analysis and reputation requirements.
            </span>
          </li>
        </ul>
        <p className="text-[10px] text-slate-500 mt-3">
          This site is not affiliated with Cloud Imperium Games or Roberts Space Industries.
          All game content and materials are trademarks and copyrights of their respective owners.
        </p>
      </section>
    </div>
  )
}
