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

      {/* Organizations */}
      <section>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Organizations
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Looking for an org to join? Check out the RSI Organization Hub to find a community that fits your playstyle.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="https://robertsspaceindustries.com/en/community/orgs"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-orange-500/30 hover:bg-slate-800/60 transition-all"
          >
            <div className="shrink-0 p-2 rounded-lg bg-slate-700/50 text-slate-400 group-hover:text-orange-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-slate-200 group-hover:text-orange-300 transition-colors flex items-center gap-1">
                RSI Organization Hub
                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">Browse all Star Citizen organizations on the official RSI site</p>
            </div>
          </a>

          <a
            href="https://robertsspaceindustries.com/en/orgs/BSTR"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 p-3 rounded-lg bg-gradient-to-br from-slate-800/60 to-orange-900/20 border border-orange-500/30 hover:border-orange-500/50 hover:from-slate-800/80 hover:to-orange-900/30 transition-all"
          >
            <div className="shrink-0 p-2 rounded-lg bg-orange-500/20 text-orange-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-slate-200 group-hover:text-orange-300 transition-colors flex items-center gap-1">
                Black Star [BSTR]
                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </h4>
              <p className="text-[10px] text-orange-400/80 uppercase tracking-wide">Site Sponsor</p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">Industrial and defense enterprise focused on extraction, production, and trade</p>
            </div>
          </a>
        </div>
      </section>

      {/* Discord Notifications */}
      <section>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Discord Notifications
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Get Dumper's Repo updates sent directly to your Discord server. Receive notifications about new orders and blueprint data syncs.
        </p>
        <div className="p-4 rounded-lg bg-indigo-950/30 border border-indigo-500/30 space-y-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-indigo-300 mb-1">How it works</h4>
              <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
                <li>Create a webhook in your Discord server (Server Settings → Integrations → Webhooks)</li>
                <li>Copy the webhook URL</li>
                <li>Register it on our subscribe page and choose which events to receive</li>
                <li>Your channel will automatically receive notifications</li>
              </ol>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/discord-subscribe"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Subscribe Your Channel
            </a>
          </div>
          <div className="pt-2 border-t border-indigo-500/20">
            <p className="text-[10px] text-slate-500">
              <strong className="text-slate-400">Available notifications:</strong> Order activity (new orders, fulfillments) and Blueprint data syncs.
              Notifications are one-way — your Discord receives updates but cannot send commands back.
            </p>
          </div>
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
