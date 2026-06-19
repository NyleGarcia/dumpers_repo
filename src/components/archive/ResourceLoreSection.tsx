import React, { useEffect, useMemo, useState } from 'react'
import { getResourceType } from '../../config/resourceTypes'
import { getResourceLoreEntries, lore } from '../../data/index'
import {
  hasResourceLoreUiState,
  readResourceLoreUiState,
  writeResourceLoreUiState,
} from '../../lib/resourceLoreUiState'

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

function getResourceLoreCategory(resourceKey: string, label: string): string {
  const lowerLabel = label.toLowerCase()

  if (
    lowerLabel.includes('medical') ||
    lowerLabel.includes('medstick') ||
    lowerLabel.includes('kopion') ||
    lowerLabel.includes('molina')
  ) {
    return 'Medical'
  }

  if (
    lowerLabel.includes('refined') ||
    ['diamond', 'silnex', 'neograph', 'thermalfoam'].includes(resourceKey)
  ) {
    return 'Refined Materials'
  }

  switch (getResourceType(resourceKey)) {
    case 'ore':
      return 'Ores & Minerals'
    case 'gem':
      return 'Gems & Hand Mineables'
    case 'gas':
    case 'halogen':
      return 'Gases'
    case 'fuel':
    case 'salvage':
      return 'Industrial'
    case 'contraband':
      return 'Contraband'
    case 'trade_good':
    case 'harvest':
    case 'shop_special':
      return 'Trade Goods'
    default:
      return 'Other'
  }
}

function readInitialCollapsedCategories(): Set<string> {
  if (!hasResourceLoreUiState()) {
    return new Set(CATEGORY_ORDER)
  }
  return new Set(readResourceLoreUiState().collapsedCategoryIds)
}

export default function ResourceLoreSection() {
  const [search, setSearch] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    readInitialCollapsedCategories
  )

  const loreEntries = useMemo(() => getResourceLoreEntries(), [])

  const categorizedResources = useMemo(() => {
    const categories = new Map<string, typeof loreEntries>()
    const searchLower = search.toLowerCase()

    for (const entry of loreEntries) {
      if (
        searchLower &&
        !entry.label.toLowerCase().includes(searchLower) &&
        !entry.description.toLowerCase().includes(searchLower)
      ) {
        continue
      }

      const category = getResourceLoreCategory(entry.resourceKey, entry.label)
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(entry)
    }

    for (const entries of categories.values()) {
      entries.sort((a, b) => a.label.localeCompare(b.label))
    }

    return categories
  }, [loreEntries, search])

  const visibleCategories = useMemo(
    () => CATEGORY_ORDER.filter((category) => (categorizedResources.get(category)?.length ?? 0) > 0),
    [categorizedResources]
  )

  useEffect(() => {
    writeResourceLoreUiState({
      collapsedCategoryIds: [...collapsedCategories],
    })
  }, [collapsedCategories])

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
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

  if (loreEntries.length === 0) {
    return (
      <div className="p-4 bg-amber-900/30 border border-amber-500/30 rounded-lg">
        <h3 className="text-sm font-medium text-amber-300 mb-2">Resource Lore Not Available</h3>
        <p className="text-xs text-amber-200/70">
          Commodity lore has not been extracted yet. Run the game data pipeline locally:
        </p>
        <ul className="text-xs text-slate-400 mt-2 list-disc list-inside space-y-1">
          <li>
            <code className="text-violet-300">.\scripts\extract-game-data.ps1</code>
          </li>
          <li>
            <code className="text-violet-300">node scripts/parse-extracted-data.mjs</code>
          </li>
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-400 mb-4">
          Lore and flavor text for Star Citizen commodities, sourced directly from game localization files
          extracted via StarBreaker.
        </p>

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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Showing {totalVisible} of {lore.summary.totalDescriptions} resources with lore
        </p>
      </div>

      {visibleCategories.length > 0 && (
        <div className="flex items-center justify-end gap-1">
          {!visibleCategories.every((category) => collapsedCategories.has(category)) && (
            <button
              type="button"
              onClick={() => setCollapsedCategories(new Set(visibleCategories))}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded transition-colors"
            >
              Close All
            </button>
          )}
          {visibleCategories.some((category) => collapsedCategories.has(category)) && (
            <button
              type="button"
              onClick={() => setCollapsedCategories(new Set())}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded transition-colors"
            >
              Open All
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const entries = categorizedResources.get(category)
          if (!entries || entries.length === 0) return null

          const isCollapsed = collapsedCategories.has(category)

          return (
            <div key={category} className="border border-slate-700/50 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800/70 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="text-sm font-medium text-slate-200">{category}</span>
                </div>
                <span className="text-xs text-slate-500 shrink-0">{entries.length}</span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-slate-700/30">
                  {entries.map((entry) => (
                    <div key={entry.resourceKey} className="p-4 bg-slate-900/30">
                      <h4 className="text-sm font-medium text-orange-300 mb-2">{entry.label}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{entry.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="text-xs text-slate-600 text-center pt-4 border-t border-slate-700/30">
        {lore._source} · Last extracted {new Date(lore._extracted).toLocaleDateString()}
      </div>
    </div>
  )
}
