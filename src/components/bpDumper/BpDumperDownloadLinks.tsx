import React from 'react'
import {
  BP_DUMPER_DOWNLOADS,
  BP_DUMPER_VERSION,
  GITHUB_RELEASES_PAGE,
  getBpDumperDownloadUrl,
} from '../../config/bpDumper'

export default function BpDumperDownloadLinks() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-300">
          Latest release:{' '}
          <span className="text-amber-300 font-medium">v{BP_DUMPER_VERSION}</span>
        </p>
        <a
          href={GITHUB_RELEASES_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-amber-300 underline underline-offset-2"
        >
          View all releases
        </a>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {BP_DUMPER_DOWNLOADS.map((option) => (
          <a
            key={option.id}
            href={getBpDumperDownloadUrl(option.filename)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-0.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 hover:border-amber-500/40 hover:bg-slate-800 transition-colors"
          >
            <span className="text-sm font-medium text-white">{option.label}</span>
            <span className="text-xs text-slate-400">{option.description}</span>
            <span className="text-[11px] text-slate-500 font-mono truncate">{option.filename}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
