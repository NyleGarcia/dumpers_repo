import React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import type { AppNavItem } from '../../config/appNav'

interface AppNavTabsProps {
  items: AppNavItem[]
  className?: string
}

export default function AppNavTabs({ items, className = '' }: AppNavTabsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (items.length === 0) return null

  return (
    <nav className={`flex items-center gap-1.5 ${className}`} aria-label="Site navigation">
      {items.map((item) => {
        const isActive = pathname === item.path
        return (
          <Link
            key={item.id}
            to={item.path}
            className={`site-nav-link ${isActive ? 'site-nav-link-active' : 'site-nav-link-idle'}`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
