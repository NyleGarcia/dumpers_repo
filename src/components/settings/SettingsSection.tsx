import React from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  variant?: 'default' | 'danger'
}

export default function SettingsSection({
  title,
  description,
  children,
  variant = 'default',
}: SettingsSectionProps) {
  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-800/30 overflow-hidden">
      <div className={`px-4 py-3 border-b border-slate-700/80 ${
        variant === 'danger' ? 'bg-red-950/20' : 'bg-slate-800/50'
      }`}>
        <h3 className={`text-sm font-semibold ${
          variant === 'danger' ? 'text-red-400' : 'text-slate-200'
        }`}>
          {title}
        </h3>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  )
}
