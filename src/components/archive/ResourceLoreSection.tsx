import React, { useState, useMemo, useEffect } from 'react'

interface ResourceLoreEntry {
  label: string
  description: string
  source_url: string
}

interface LoreData {
  generated_at: string
  source: string
  count: number
  resources: Record<string, ResourceLoreEntry>
}

const CATEGORY_ORDER = [
  'Ores & Minerals',
  'Refined Materials',
  'Gems & Hand Mineables',
  'Gases',
  'Contraband',
  'Trade Goods',
  'Medical',
  'Industrial',
  'Other',
]

function categorizeResource(key: string, label: string): string {
  const lowerKey = key.toLowerCase()
  const lowerLabel = label.toLowerCase()
  
  // Ores & Minerals
  if (lowerKey.includes('ore') || ['iron', 'copper', 'titanium', 'aluminum', 'tungsten', 'gold', 'tin'].includes(lowerKey)) {
    return 'Ores & Minerals'
  }
  if (['quantainium', 'laranite', 'agricium', 'bexalite', 'borase', 'taranite', 'beryl', 'aslarite', 'hephaestanite', 'corundum', 'riccite', 'stileron'].includes(lowerKey)) {
    return 'Ores & Minerals'
  }
  
  // Gems & Hand Mineables
  if (['hadanite', 'aphorite', 'dolivine', 'janalite', 'sadaryx'].includes(lowerKey)) {
    return 'Gems & Hand Mineables'
  }
  
  // Gases
  if (['hydrogen', 'nitrogen', 'argon', 'helium', 'xenon', 'krypton', 'methane', 'tritium', 'anti_hydrogen', 'partillium'].includes(lowerKey)) {
    return 'Gases'
  }
  
  // Contraband
  if (['altruciatoxin', 'widow', 'slam', 'neon', 'e_tam', 'maze', 'glow', 'freeze', 'thrust', 'mala', 'dopple', 'zip', 'dcsr2'].includes(lowerKey)) {
    return 'Contraband'
  }
  if (['osoian_hides', 'gasping_weevil_eggs', 'human_food_bars', 'lifecure_medsticks', 'redfin_energy_modulators'].includes(lowerKey)) {
    return 'Contraband'
  }
  
  // Medical
  if (lowerLabel.includes('medical') || lowerLabel.includes('medstick') || lowerLabel.includes('kopion') || lowerLabel.includes('molina')) {
    return 'Medical'
  }
  
  // Trade Goods
  if (lowerLabel.includes('food') || lowerLabel.includes('supplies') || ['distilled_spirits', 'stims', 'souvenirs', 'fireworks'].includes(lowerKey)) {
    return 'Trade Goods'
  }
  
  // Industrial
  if (['rmc', 'construction_material', 'scrap', 'waste', 'compboard', 'steel'].includes(lowerKey)) {
    return 'Industrial'
  }
  if (lowerLabel.includes('composite') || lowerLabel.includes('laminate') || lowerLabel.includes('coating')) {
    return 'Industrial'
  }
  
  // Refined Materials
  if (lowerLabel.includes('refined') || ['diamond', 'prota', 'silnex', 'neograph', 'thermalfoam'].includes(lowerKey)) {
    return 'Refined Materials'
  }
  
  return 'Other'
}

export default function ResourceLoreSection() {
  const [loreData, setLoreData] = useState<LoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER))

  useEffect(() => {
    async function loadLore() {
      try {
        const response = await fetch('/data/resource-lore.json')
        if (!response.ok) {
          throw new Error('Lore data not found. Run the sync script to generate it.')
        }
        const data = await response.json()
        setLoreData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lore data')
      } finally {
        setLoading(false)
      }
    }
    loadLore()
  }, [])

  const categorizedResources = useMemo(() => {
    if (!loreData?.resources) return new Map<string, Array<{ key: string; entry: ResourceLoreEntry }>>()
    
    const categories = new Map<string, Array<{ key: string; entry: ResourceLoreEntry }>>()
    const searchLower = search.toLowerCase()
    
    for (const [key, entry] of Object.entries(loreData.resources)) {
      // Filter by search
      if (searchLower && !entry.label.toLowerCase().includes(searchLower) && !entry.description.toLowerCase().includes(searchLower)) {
        continue
      }
      
      const category = categorizeResource(key, entry.label)
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push({ key, entry })
    }
    
    // Sort entries within each category
    for (const entries of categories.values()) {
      entries.sort((a, b) => a.entry.label.localeCompare(b.entry.label))
    }
    
    return categories
  }, [loreData, search])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const totalVisible = useMemo(() => {
    let count = 0
    for (const entries of categorizedResources.values()) {
      count += entries.length
    }
    return count
  }, [categorizedResources])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-amber-900/30 border border-amber-500/30 rounded-lg">
        <h3 className="text-sm font-medium text-amber-300 mb-2">Resource Lore Not Available</h3>
        <p className="text-xs text-amber-200/70">{error}</p>
        <p className="text-xs text-slate-400 mt-2">
          Super-admins can generate this data via DB Actions → "Fetch Resource Lore" script.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-slate-400 mb-4">
          Lore and flavor text for Star Citizen resources, sourced from the{' '}
          <a
            href="https://starcitizen.tools"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-300 underline"
          >
            Star Citizen Wiki
          </a>
          .
        </p>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full px-4 py-2 pl-10 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <p className="text-xs text-slate-500 mt-2">
          Showing {totalVisible} of {loreData?.count ?? 0} resources with lore
        </p>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const entries = categorizedResources.get(category)
          if (!entries || entries.length === 0) return null
          
          const isExpanded = expandedCategories.has(category)
          
          return (
            <div key={category} className="border border-slate-700/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800/70 transition-colors text-left"
              >
                <span className="text-sm font-medium text-slate-200">{category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{entries.length}</span>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isExpanded && (
                <div className="divide-y divide-slate-700/30">
                  {entries.map(({ key, entry }) => (
                    <div key={key} className="p-4 bg-slate-900/30">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-sm font-medium text-orange-300">{entry.label}</h4>
                        <a
                          href={entry.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-slate-500 hover:text-orange-400 transition-colors"
                          title="View on Star Citizen Wiki"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{entry.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {loreData && (
        <div className="text-xs text-slate-600 text-center pt-4 border-t border-slate-700/30">
          Data sourced from {loreData.source} · Last updated {new Date(loreData.generated_at).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
