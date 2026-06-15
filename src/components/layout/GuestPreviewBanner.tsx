import React from 'react'

export default function GuestPreviewBanner() {
  return (
    <div className="bg-amber-950/60 border-b border-amber-500/30">
      <div className="site-shell py-2 text-sm text-center">
        <p className="text-amber-200/90">
          <strong className="text-amber-100">Offline Mode</strong> — Your data saves in this browser only. 
          Sign in to sync across devices and keep it permanently.
          Member accounts are{' '}
          <strong className="text-amber-100 font-medium">free</strong> with{' '}
          <strong className="text-amber-100 font-medium">full access</strong>.
        </p>
      </div>
    </div>
  )
}
