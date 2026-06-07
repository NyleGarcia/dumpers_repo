import React from 'react'

interface SettingsToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  saving?: boolean
}

export default function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  saving = false,
}: SettingsToggleProps) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || saving}
        className="sr-only peer"
      />
      <div
        className="mt-0.5 shrink-0 w-10 h-5 rounded-full bg-slate-700 border border-slate-600 transition-colors relative
          peer-checked:bg-purple-600 peer-checked:border-purple-500/50
          after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:rounded-full after:bg-slate-200
          after:transition-transform after:duration-200 peer-checked:after:translate-x-5 peer-checked:after:bg-white"
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{label}</span>
          {saving && <span className="text-xs text-slate-500">Saving...</span>}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </label>
  )
}
