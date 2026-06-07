import React from 'react'

interface SettingsFieldProps {
  label: string
  hint?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export default function SettingsField({ label, hint, children, action }: SettingsFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {action}
    </div>
  )
}
