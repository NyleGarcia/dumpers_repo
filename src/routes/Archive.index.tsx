import React, { useCallback } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import ArchiveWelcome from '../components/archive/ArchiveWelcome'
import MiningSection from '../components/archive/MiningSection'
import ComponentsSection from '../components/archive/ComponentsSection'
import OrdnanceSection from '../components/archive/OrdnanceSection'
import FactionsSection from '../components/archive/FactionsSection'
import GeneralArchiveSection from '../components/archive/GeneralArchiveSection'

export type ArchiveSection = 'welcome' | 'mining' | 'components' | 'ordnance' | 'factions' | 'general'

interface ArchiveSearchParams {
  section?: ArchiveSection
}

const SECTION_TITLES: Record<ArchiveSection, string> = {
  welcome: 'Information Archive',
  mining: 'Mining Guide',
  components: 'Component Database',
  ordnance: 'Ordnance Reference',
  factions: 'Faction Reference',
  general: 'General Archive',
}

export default function ArchivePage() {
  const searchParams = useSearch({ strict: false }) as ArchiveSearchParams
  const navigate = useNavigate()

  const currentSection: ArchiveSection = searchParams.section || 'welcome'

  const setSection = useCallback(
    (section: ArchiveSection) => {
      navigate({
        to: '/archive',
        search: section === 'welcome' ? {} : { section },
        replace: true,
      })
    },
    [navigate]
  )

  const sectionTitle = SECTION_TITLES[currentSection]

  const renderSection = () => {
    switch (currentSection) {
      case 'welcome':
        return <ArchiveWelcome onNavigate={setSection} />
      case 'mining':
        return <MiningSection />
      case 'components':
        return <ComponentsSection />
      case 'ordnance':
        return <OrdnanceSection />
      case 'factions':
        return <FactionsSection />
      case 'general':
        return <GeneralArchiveSection />
      default:
        return <ArchiveWelcome onNavigate={setSection} />
    }
  }

  return (
    <div className="site-shell py-6 min-h-[calc(100vh-8rem)]">
      {/* Page header */}
      <header className="mb-6">
        <h1 className="site-page-title">{sectionTitle}</h1>
        <p className="site-page-subtitle">Star Citizen Reference Data</p>
      </header>

      {/* Content */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 sm:p-6 min-h-[500px]">
        {renderSection()}
      </div>
    </div>
  )
}
