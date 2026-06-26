import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppModal from '../layout/AppModal'
import SiteTooltip from '../SiteTooltip'
import { useAuth } from '../../contexts/AuthContext'
import { useResourceCatalog } from '../../hooks/useResourceCatalog'
import { useMiningLedger } from '../../hooks/useMiningLedger'
import { DEFAULT_STOCK_QUALITY } from '../../config/dfp'
import { getResourceType } from '../../config/resourceTypes'
import type { BlueprintResourceRow } from '../../lib/operations'
import {
  buildLedgerExportJson,
  computeMiningLedger,
  copyPayoutAmount,
  defaultPricePer100,
  downloadLedgerJson,
  formatLedgerMoney,
  newLedgerRowId,
  seedCrewMemberOnce,
  shortLedgerId,
  type MiningLedgerCrewMember,
  type MiningLedgerData,
  type MiningLedgerDeductible,
  type MiningLedgerMiningRow,
  type MiningLedgerOtherProfit,
  type MiningLedgerPriceOverride,
} from '../../lib/miningLedger'
import {
  lookupRsiVerifiedMemberByHandle,
  searchVerifiedMembersForLedger,
  type VerifiedMemberSearchResult,
} from '../../lib/miningLedgerOps'
import {
  checkRsiHandleExistsOnRsi,
  CREW_RSI_INVALID_HANDLE_TOOLTIP,
  CREW_RSI_VALID_NOT_REGISTERED_TOOLTIP,
  CREW_RSI_VERIFIED_MEMBER_TOOLTIP,
  sanitizeRsiHandleInput,
  type CrewRsiAlertState,
} from '../../lib/rsiHandleCheck'

interface MiningLedgerTabProps {
  isGuestPreview: boolean
}

/** Sticky section title row — stays visible while the page scrolls; tables grow below with no inner scroll. */
const LEDGER_SECTION_HEAD =
  'sticky top-14 z-[5] flex flex-wrap items-center justify-between gap-2 py-2 mb-1 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/60'

/** Horizontal scroll for wide tables only — no vertical clipping inside sections. */
const LEDGER_TABLE_SCROLL = 'overflow-x-auto overflow-y-visible'

function oreCatalogEntries(catalog: BlueprintResourceRow[]) {
  return catalog.filter((row) => {
    const type = getResourceType(row.resource_key)
    return type === 'ore' || type === 'gem'
  })
}

function ensurePriceOverrides(
  data: MiningLedgerData,
  oreEntries: BlueprintResourceRow[]
): MiningLedgerPriceOverride[] {
  const byKey = new Map(data.priceOverrides.map((row) => [row.resourceKey, row]))
  for (const entry of oreEntries) {
    if (!byKey.has(entry.resource_key)) {
      byKey.set(entry.resource_key, {
        resourceKey: entry.resource_key,
        resourceLabel: entry.label,
        pricePer100: null,
      })
    }
  }
  return [...byKey.values()].sort((a, b) => a.resourceLabel.localeCompare(b.resourceLabel))
}

function CrewRsiAlertIcon({ state }: { state: CrewRsiAlertState }) {
  if (state === 'idle' || state === 'checking') {
    if (state === 'checking') {
      return (
        <span className="shrink-0 w-4 h-4 border-2 border-slate-500/40 border-t-slate-400 rounded-full animate-spin" />
      )
    }
    return null
  }

  if (state === 'verified_member') {
    return (
      <SiteTooltip content={CREW_RSI_VERIFIED_MEMBER_TOOLTIP} side="top">
        <span className="shrink-0 text-emerald-400 cursor-help" aria-label="Verified site member">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
      </SiteTooltip>
    )
  }

  if (state === 'valid_not_registered') {
    return (
      <SiteTooltip content={CREW_RSI_VALID_NOT_REGISTERED_TOOLTIP} side="top">
        <span className="shrink-0 text-amber-400 cursor-help" aria-label="Valid RSI, not on site">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </span>
      </SiteTooltip>
    )
  }

  return (
    <SiteTooltip content={CREW_RSI_INVALID_HANDLE_TOOLTIP} side="top">
      <span className="shrink-0 text-red-400 cursor-help" aria-label="Invalid RSI handle">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>
    </SiteTooltip>
  )
}

function CrewPlayerNameField({
  value,
  linkedUserId,
  onChange,
}: {
  value: string
  linkedUserId: string | null
  onChange: (name: string, linkedUserId: string | null) => void
}) {
  const [query, setQuery] = useState(value)
  const [options, setOptions] = useState<VerifiedMemberSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [alertState, setAlertState] = useState<CrewRsiAlertState>('idle')
  const skipValidationRef = useRef(false)
  const validateSeqRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (linkedUserId && value.trim()) {
      setAlertState('verified_member')
    }
  }, [linkedUserId, value])

  useEffect(() => {
    const trimmed = query.trim()
    if (linkedUserId || trimmed.length < 2) {
      setOptions([])
      setOpen(false)
      if (!linkedUserId) setAlertState('idle')
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await searchVerifiedMembersForLedger(trimmed)
      setOptions(data)
      if (
        focused &&
        !linkedUserId &&
        inputRef.current &&
        document.activeElement === inputRef.current
      ) {
        setOpen(data.length > 0)
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, linkedUserId, focused])

  useEffect(() => {
    if (skipValidationRef.current) {
      skipValidationRef.current = false
      return
    }

    const handle = sanitizeRsiHandleInput(query.trim())
    if (!handle || handle.length < 2) {
      if (!linkedUserId) setAlertState('idle')
      return
    }

    if (linkedUserId) {
      setAlertState('verified_member')
      return
    }

    const seq = ++validateSeqRef.current
    setAlertState('checking')

    const timeout = setTimeout(async () => {
      const { valid } = await checkRsiHandleExistsOnRsi(handle)
      if (seq !== validateSeqRef.current) return

      if (!valid) {
        setAlertState('invalid_rsi')
        return
      }

      const { data: member } = await lookupRsiVerifiedMemberByHandle(handle)
      if (seq !== validateSeqRef.current) return

      if (member) {
        const label = member.rsi_handle || member.display_name || handle
        skipValidationRef.current = true
        onChangeRef.current(label, member.id)
        setQuery(label)
        setAlertState('verified_member')
      } else {
        setAlertState('valid_not_registered')
      }
    }, 600)

    return () => clearTimeout(timeout)
  }, [query, linkedUserId])

  return (
    <div className="w-44 max-w-44 shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const next = sanitizeRsiHandleInput(e.target.value)
            setQuery(next)
            onChange(next, null)
          }}
          onBlur={() => {
            setFocused(false)
            window.setTimeout(() => setOpen(false), 150)
          }}
          onFocus={(e) => {
            setFocused(true)
            if (
              e.isTrusted &&
              options.length > 0 &&
              !linkedUserId
            ) {
              setOpen(true)
            }
          }}
          placeholder="RSI handle"
          className="site-input flex-1 min-w-0 w-0 px-2 py-1 text-xs"
          spellCheck={false}
          autoComplete="off"
        />
        <CrewRsiAlertIcon state={alertState} />
      </div>
      {open && options.length > 0 && (
        <ul className="relative z-30 mt-1 w-44 max-w-44 rounded-lg border border-slate-600 bg-slate-900 shadow-lg">
          {options.map((member) => {
            const label = member.rsi_handle || member.display_name || 'Unknown'
            return (
              <li key={member.id}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-xs hover:bg-slate-800 text-white truncate"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    skipValidationRef.current = true
                    onChange(label, member.id)
                    setQuery(label)
                    setAlertState('verified_member')
                    setOpen(false)
                  }}
                >
                  {label}
                  {member.rsi_handle &&
                  member.display_name &&
                  member.display_name !== member.rsi_handle ? (
                    <span className="text-slate-500 ml-1">({member.display_name})</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function MiningLedgerTab({ isGuestPreview }: MiningLedgerTabProps) {
  const { user, profile } = useAuth()
  const isRsiVerified = profile?.rsi_handle_verified ?? false
  const { catalog, loading: catalogLoading } = useResourceCatalog()
  const {
    ledgers,
    activeId,
    detail,
    data,
    ledgerName,
    loading,
    saving,
    error,
    setError,
    updateData,
    updateName,
    createLedger,
    selectLedger,
    closeLedger,
    addCollaborator,
    removeCollaborator,
  } = useMiningLedger()

  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeModalDismissed, setCloseModalDismissed] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newLedgerName, setNewLedgerName] = useState('')
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [collabSearch, setCollabSearch] = useState('')
  const [collabOptions, setCollabOptions] = useState<VerifiedMemberSearchResult[]>([])
  const [copyToast, setCopyToast] = useState<string | null>(null)

  const oreEntries = useMemo(() => oreCatalogEntries(catalog), [catalog])
  const computed = useMemo(() => computeMiningLedger(data), [data])
  const isLedgerCreator = Boolean(user && detail && detail.created_by === user.id)

  useEffect(() => {
    if (computed.allCrewPaid && activeId && data.crew.length > 0 && !closeModalDismissed) {
      setShowCloseModal(true)
    }
    if (!computed.allCrewPaid) {
      setCloseModalDismissed(false)
    }
  }, [computed.allCrewPaid, activeId, data.crew.length, closeModalDismissed])

  useEffect(() => {
    if (collabSearch.trim().length < 2) {
      setCollabOptions([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data: results } = await searchVerifiedMembersForLedger(collabSearch.trim())
      setCollabOptions(results)
    }, 250)
    return () => clearTimeout(timeout)
  }, [collabSearch])

  const seedPriceTable = useCallback(() => {
    updateData((prev) => ({
      ...prev,
      priceOverrides: ensurePriceOverrides(prev, oreEntries),
    }))
  }, [oreEntries, updateData])

  useEffect(() => {
    if (oreEntries.length > 0 && data.priceOverrides.length === 0) {
      seedPriceTable()
    }
  }, [oreEntries, data.priceOverrides.length, seedPriceTable])

  const handleExport = useCallback(() => {
    if (!activeId) return
    const payload = buildLedgerExportJson(activeId, ledgerName, data, computed)
    const safeName = ledgerName.replace(/[^\w-]+/g, '_').slice(0, 40) || 'ledger'
    downloadLedgerJson(payload, `mining-ledger-${safeName}-${shortLedgerId(activeId)}.json`)
  }, [activeId, ledgerName, data, computed])

  const handleCloseConfirm = async () => {
    if (!activeId) return
    handleExport()
    const { error: closeError } = await closeLedger()
    setShowCloseModal(false)
    if (closeError) setError(closeError)
  }

  const handleDeleteLedger = async () => {
    const { error: deleteError } = await closeLedger()
    setShowDeleteModal(false)
    if (deleteError) setError(deleteError)
  }

  const handleCreateLedger = async () => {
    const name = newLedgerName.trim()
    if (!name || !user) return
    const playerName =
      profile?.rsi_handle?.trim() ||
      profile?.display_name?.trim() ||
      user.email?.split('@')[0] ||
      'Unknown'
    const id = await createLedger(name, { userId: user.id, playerName })
    if (id) {
      setShowNewModal(false)
      setNewLedgerName('')
    }
  }

  const patchCrew = (id: string, patch: Partial<MiningLedgerCrewMember>) => {
    updateData((prev) => ({
      ...prev,
      crew: prev.crew.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }))
  }

  const patchMiningRow = (id: string, patch: Partial<MiningLedgerMiningRow>) => {
    updateData((prev) => ({
      ...prev,
      miningRows: prev.miningRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }))
  }

  if (isGuestPreview) {
    return (
      <div className="text-center py-12 rounded-lg border border-dashed border-slate-700/50">
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Mining crew ledgers require a signed-in account with a verified RSI Handle. Sign in and
          verify your handle in Profile Settings to create ledgers and track crew payouts.
        </p>
      </div>
    )
  }

  if (!isRsiVerified) {
    return (
      <div className="text-center py-12 rounded-lg border border-dashed border-amber-500/30 bg-amber-950/10">
        <p className="text-slate-300 text-sm max-w-md mx-auto">
          Mining crew ledgers are available to members with a{' '}
          <strong className="text-amber-300/90">verified RSI Handle</strong> on Dumper&apos;s Repo.
          Open <strong className="text-white">Profile Settings</strong> from the user menu to validate
          your handle, then return here.
        </p>
      </div>
    )
  }

  if (loading || catalogLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
            Ledger
          </label>
          <select
            value={activeId ?? ''}
            onChange={(e) => void selectLedger(e.target.value)}
            className="site-input w-full px-2 py-1.5 text-sm"
            disabled={ledgers.length === 0}
          >
            {ledgers.length === 0 ? (
              <option value="">No ledgers yet</option>
            ) : (
              ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.name} ({shortLedgerId(ledger.id)})
                </option>
              ))
            )}
          </select>
        </div>
        <div className="flex-1 min-w-[160px] max-w-xs">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
            Display name
          </label>
          <input
            type="text"
            value={ledgerName}
            onChange={(e) => updateName(e.target.value)}
            disabled={!activeId}
            className="site-input w-full px-2 py-1.5 text-sm"
            maxLength={120}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="px-3 py-1.5 text-xs rounded-lg border border-orange-500/40 text-orange-300 hover:bg-orange-500/10"
        >
          New ledger
        </button>
        {activeId && (
          <>
            {isLedgerCreator && (
              <button
                type="button"
                onClick={() => setShowAccessModal(true)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Manage access
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              Delete ledger
            </button>
          </>
        )}
        {saving && <span className="text-xs text-slate-500 self-center">Saving…</span>}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {copyToast && (
        <p className="text-xs text-emerald-400">{copyToast}</p>
      )}

      {!activeId ? (
        <div className="text-center py-10 rounded-lg border border-dashed border-slate-700/50">
          <p className="text-slate-500 text-sm mb-3">No ledger selected. Create one to get started.</p>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 text-sm rounded-lg bg-orange-600/80 hover:bg-orange-600 text-white"
          >
            Create ledger
          </button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className={`${LEDGER_TABLE_SCROLL} grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs min-w-0`}>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 min-w-[7.5rem]">
              <span className="text-slate-500 block">Pool (est.)</span>
              <span className="text-white font-mono tabular-nums whitespace-nowrap">{formatLedgerMoney(computed.poolEstimate)}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 min-w-[7.5rem]">
              <span className="text-slate-500 block">Pool (actual)</span>
              <span className="text-slate-400 font-mono tabular-nums whitespace-nowrap">{formatLedgerMoney(computed.poolActual)}</span>
              <span className="text-[10px] text-slate-600 block">Ore profit act. only</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 min-w-[8.5rem]">
              <span className="text-slate-500 block">Total payout</span>
              <span className="text-amber-300 font-mono tabular-nums whitespace-nowrap">
                {formatLedgerMoney(computed.totalPayout)}
              </span>
              <span className="text-[10px] text-slate-600 block">Ore − deductibles + extras</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 min-w-[7.5rem]">
              <span className="text-slate-500 block">Total shares</span>
              <span className="text-white font-mono tabular-nums">{computed.totalShares}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 min-w-[7.5rem]">
              <span className="text-slate-500 block">Ore pricing</span>
              <span className="text-slate-300 text-[11px]">Purchased Q0 DFP</span>
            </div>
          </div>

          {/* Mining runs */}
          <section>
            <div className={LEDGER_SECTION_HEAD}>
              <h3 className="text-sm font-semibold text-white">Mining runs</h3>
              <button
                type="button"
                onClick={() =>
                  updateData((prev) => ({
                    ...prev,
                    miningRows: [
                      ...prev.miningRows,
                      {
                        id: newLedgerRowId(),
                        resourceKey: oreEntries[0]?.resource_key ?? '',
                        resourceLabel: oreEntries[0]?.label ?? '',
                        quality: DEFAULT_STOCK_QUALITY,
                        unrefinedCscu: 0,
                        yieldActual: null,
                      },
                    ],
                  }))
                }
                className="text-xs text-orange-400 hover:text-orange-300"
                disabled={oreEntries.length === 0}
              >
                + Add row
              </button>
            </div>
            <div className={LEDGER_TABLE_SCROLL}>
            <table className="w-full min-w-[52rem] text-xs table-fixed">
              <colgroup>
                <col style={{ width: '9rem' }} />
                <col style={{ width: '4rem' }} />
                <col style={{ width: '6.5rem' }} />
                <col style={{ width: '6.5rem' }} />
                <col style={{ width: '6.5rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '2rem' }} />
              </colgroup>
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-700/50">
                  <th className="py-1 pr-2">Ore</th>
                  <th className="py-1 pr-2">Q</th>
                  <th className="py-1 pr-2">Unrefined cSCU</th>
                  <th className="py-1 pr-2">Yield est. (cSCU)</th>
                  <th className="py-1 pr-2">Yield act. (cSCU)</th>
                  <th className="py-1 pr-2">Profit est.</th>
                  <th className="py-1 pr-2">Profit act.</th>
                  <th className="py-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {data.miningRows.map((row) => {
                  const calc = computed.miningRows.find((r) => r.id === row.id)
                  return (
                    <tr key={row.id} className="border-b border-slate-800/60">
                      <td className="py-1 pr-2">
                        <select
                          value={row.resourceKey}
                          onChange={(e) => {
                            const entry = oreEntries.find((o) => o.resource_key === e.target.value)
                            patchMiningRow(row.id, {
                              resourceKey: e.target.value,
                              resourceLabel: entry?.label ?? e.target.value,
                            })
                          }}
                          className="site-input w-[8.5rem] max-w-[8.5rem] px-1 py-0.5 text-xs"
                        >
                          {oreEntries.map((entry) => (
                            <option key={entry.resource_key} value={entry.resource_key}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          value={row.quality}
                          onChange={(e) =>
                            patchMiningRow(row.id, { quality: Number(e.target.value) || 0 })
                          }
                          className="site-input w-16 max-w-16 shrink-0 px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          value={row.unrefinedCscu || ''}
                          onChange={(e) =>
                            patchMiningRow(row.id, {
                              unrefinedCscu: Number(e.target.value) || 0,
                            })
                          }
                          className="site-input w-[6rem] max-w-[6rem] shrink-0 px-1 py-0.5 text-xs"
                          min={0}
                          step="any"
                        />
                      </td>
                      <td className="py-1 pr-2 font-mono text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {calc?.yieldEstimate ?? '—'}
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          value={row.yieldActual ?? ''}
                          placeholder={String(calc?.yieldEstimate ?? '')}
                          onChange={(e) =>
                            patchMiningRow(row.id, {
                              yieldActual:
                                e.target.value === '' ? null : Number(e.target.value) || 0,
                            })
                          }
                          className="site-input w-[6rem] max-w-[6rem] shrink-0 px-1 py-0.5 text-xs"
                          min={0}
                          step="any"
                        />
                      </td>
                      <td className="py-1 pr-2 font-mono text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {calc ? formatLedgerMoney(calc.profitEstimate) : '—'}
                      </td>
                      <td className="py-1 pr-2 font-mono text-amber-300/90 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {calc ? formatLedgerMoney(calc.profitActual) : '—'}
                      </td>
                      <td className="py-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateData((prev) => ({
                              ...prev,
                              miningRows: prev.miningRows.filter((r) => r.id !== row.id),
                            }))
                          }
                          className="text-slate-500 hover:text-red-400"
                          aria-label="Remove row"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </section>

          {/* Crew */}
          <section>
            <div className={LEDGER_SECTION_HEAD}>
              <div>
                <h3 className="text-sm font-semibold text-white">Crew</h3>
                <p className="text-[10px] text-slate-500">
                  Payout est. from pool estimate ÷ shares. Payout act. from total payout
                  (ore − deductibles + extras) ÷ shares.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateData((prev) => ({
                    ...prev,
                    crew: [
                      ...prev.crew,
                      {
                        id: newLedgerRowId(),
                        playerName: '',
                        linkedUserId: null,
                        shares: 1,
                        role: '',
                        isPaid: false,
                        paidPayoutAuec: null,
                      },
                    ],
                  }))
                }
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                + Add member
              </button>
            </div>
            <div className={LEDGER_TABLE_SCROLL}>
            <table className="w-full min-w-[56rem] text-xs table-fixed">
              <colgroup>
                <col style={{ width: '11rem' }} />
                <col style={{ width: '4rem' }} />
                <col style={{ width: '6rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '2.5rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '2rem' }} />
              </colgroup>
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-700/50">
                  <th className="py-1 pr-2">Member</th>
                  <th className="py-1 pr-2">Shares</th>
                  <th className="py-1 pr-2">Role</th>
                  <th className="py-1 pr-2">Payout est.</th>
                  <th className="py-1 pr-2">Payout act.</th>
                  <th className="py-1 pr-2">Paid</th>
                  <th className="py-1 pr-2">Outstanding</th>
                  <th className="py-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {computed.crew.map((member) => {
                  const row = data.crew.find((c) => c.id === member.id)
                  if (!row) return null
                  return (
                    <tr key={member.id} className="border-b border-slate-800/60 align-top">
                      <td className="py-1 pr-2 w-44 max-w-44 align-top">
                        <CrewPlayerNameField
                          value={row.playerName}
                          linkedUserId={row.linkedUserId}
                          onChange={(name, linkedUserId) =>
                            patchCrew(row.id, { playerName: name, linkedUserId })
                          }
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          value={row.shares || ''}
                          onChange={(e) =>
                            patchCrew(row.id, { shares: Number(e.target.value) || 0 })
                          }
                          className="site-input w-16 max-w-16 shrink-0 px-1 py-0.5 text-xs"
                          min={0}
                          step="any"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="text"
                          value={row.role}
                          onChange={(e) => patchCrew(row.id, { role: e.target.value })}
                          className="site-input w-24 max-w-24 shrink-0 px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-2 font-mono text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {formatLedgerMoney(member.payoutEstimate)}
                      </td>
                      <td className="py-1 pr-2 whitespace-nowrap overflow-hidden text-ellipsis">
                        <button
                          type="button"
                          onClick={async () => {
                            await copyPayoutAmount(member.payoutActual)
                            setCopyToast(`Copied ${Math.round(member.payoutActual).toLocaleString()} to clipboard`)
                            window.setTimeout(() => setCopyToast(null), 2000)
                          }}
                          className="font-mono text-amber-300 tabular-nums hover:text-amber-200 cursor-copy whitespace-nowrap"
                          title="Click to copy payout amount"
                        >
                          {formatLedgerMoney(member.payoutActual)}
                        </button>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="checkbox"
                          checked={row.isPaid}
                          onChange={(e) =>
                            patchCrew(row.id, {
                              isPaid: e.target.checked,
                              paidPayoutAuec: e.target.checked ? member.payoutActual : null,
                            })
                          }
                          className="rounded border-slate-600"
                        />
                      </td>
                      <td className="py-1 pr-2 font-mono text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {formatLedgerMoney(member.outstandingActual)}
                      </td>
                      <td className="py-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateData((prev) => ({
                              ...prev,
                              crew: prev.crew.filter((c) => c.id !== row.id),
                            }))
                          }
                          className="text-slate-500 hover:text-red-400"
                          aria-label="Remove member"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </section>

          {/* Deductibles + Other profits */}
          <div className="grid sm:grid-cols-2 gap-4">
            <section>
              <div className={LEDGER_SECTION_HEAD}>
                <h3 className="text-sm font-semibold text-white">Deductibles</h3>
                <button
                  type="button"
                  onClick={() =>
                    updateData((prev) => ({
                      ...prev,
                      deductibles: [
                        ...prev.deductibles,
                        { id: newLedgerRowId(), label: '', cost: 0 },
                      ],
                    }))
                  }
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  + Add
                </button>
              </div>
              {data.deductibles.map((row: MiningLedgerDeductible) => (
                <div key={row.id} className="flex gap-2 mb-1 items-center">
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) =>
                      updateData((prev) => ({
                        ...prev,
                        deductibles: prev.deductibles.map((d) =>
                          d.id === row.id ? { ...d, label: e.target.value } : d
                        ),
                      }))
                    }
                    placeholder="Label"
                    className="site-input flex-1 px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={row.cost || ''}
                    onChange={(e) =>
                      updateData((prev) => ({
                        ...prev,
                        deductibles: prev.deductibles.map((d) =>
                          d.id === row.id ? { ...d, cost: Number(e.target.value) || 0 } : d
                        ),
                      }))
                    }
                    className="site-input w-24 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateData((prev) => ({
                        ...prev,
                        deductibles: prev.deductibles.filter((d) => d.id !== row.id),
                      }))
                    }
                    className="text-slate-500 hover:text-red-400 shrink-0 px-1"
                    aria-label="Remove deductible"
                  >
                    ×
                  </button>
                </div>
              ))}
            </section>
            <section>
              <div className={LEDGER_SECTION_HEAD}>
                <h3 className="text-sm font-semibold text-white">Other profits</h3>
                <button
                  type="button"
                  onClick={() =>
                    updateData((prev) => ({
                      ...prev,
                      otherProfits: [
                        ...prev.otherProfits,
                        { id: newLedgerRowId(), extra: '', profit: 0 },
                      ],
                    }))
                  }
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  + Add
                </button>
              </div>
              {data.otherProfits.map((row: MiningLedgerOtherProfit) => (
                <div key={row.id} className="flex gap-2 mb-1 items-center">
                  <input
                    type="text"
                    value={row.extra}
                    onChange={(e) =>
                      updateData((prev) => ({
                        ...prev,
                        otherProfits: prev.otherProfits.map((d) =>
                          d.id === row.id ? { ...d, extra: e.target.value } : d
                        ),
                      }))
                    }
                    placeholder="Extra"
                    className="site-input flex-1 px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={row.profit || ''}
                    onChange={(e) =>
                      updateData((prev) => ({
                        ...prev,
                        otherProfits: prev.otherProfits.map((d) =>
                          d.id === row.id ? { ...d, profit: Number(e.target.value) || 0 } : d
                        ),
                      }))
                    }
                    className="site-input w-24 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateData((prev) => ({
                        ...prev,
                        otherProfits: prev.otherProfits.filter((d) => d.id !== row.id),
                      }))
                    }
                    className="text-slate-500 hover:text-red-400 shrink-0 px-1"
                    aria-label="Remove extra profit"
                  >
                    ×
                  </button>
                </div>
              ))}
            </section>
          </div>

          {/* Price list */}
          <section>
            <div className={LEDGER_SECTION_HEAD}>
              <h3 className="text-sm font-semibold text-white">Ore prices (Purchased Q0, per 100 cSCU yield)</h3>
              <button
                type="button"
                onClick={seedPriceTable}
                className="text-xs text-slate-400 hover:text-white"
              >
                Reset from catalog
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mb-2">
              Defaults use Purchased (Q0) DFP per 100 cSCU of yield. Profit = (yield cSCU ÷ 100) ×
              price. Override any row manually, or Reset from catalog if values look 100× too high.
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-700/50">
                  <th className="py-1">Ore</th>
                  <th className="py-1">Price / 100 cSCU</th>
                </tr>
              </thead>
              <tbody>
                {ensurePriceOverrides(data, oreEntries).map((row) => {
                  const defaultPrice = defaultPricePer100(row.resourceKey, row.resourceLabel)
                  const effective =
                    row.pricePer100 != null && Number.isFinite(row.pricePer100)
                      ? row.pricePer100
                      : defaultPrice
                  return (
                    <tr key={row.resourceKey} className="border-b border-slate-800/40">
                      <td className="py-1 pr-2 text-slate-300">{row.resourceLabel}</td>
                      <td className="py-1">
                        <input
                          type="number"
                          value={row.pricePer100 ?? ''}
                          placeholder={String(Math.round(defaultPrice))}
                          onChange={(e) => {
                            const val = e.target.value
                            updateData((prev) => {
                              const next = ensurePriceOverrides(prev, oreEntries).map((p) =>
                                p.resourceKey === row.resourceKey
                                  ? {
                                      ...p,
                                      pricePer100: val === '' ? null : Number(val) || 0,
                                    }
                                  : p
                              )
                              return { ...prev, priceOverrides: next }
                            })
                          }}
                          className="site-input w-32 px-2 py-0.5 text-xs font-mono"
                        />
                        {row.pricePer100 == null && (
                          <span className="text-slate-600 ml-1 tabular-nums">
                            ({Math.round(effective).toLocaleString()})
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {showNewModal && (
        <AppModal title="New ledger" onClose={() => setShowNewModal(false)} size="sm">
          <label className="text-xs text-slate-400 block mb-1">Ledger name</label>
          <input
            type="text"
            value={newLedgerName}
            onChange={(e) => setNewLedgerName(e.target.value)}
            placeholder="e.g. March Quantanium run"
            className="site-input w-full px-3 py-2 text-sm mb-4"
            maxLength={120}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-3 py-1.5 text-sm text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreateLedger()}
              className="px-4 py-1.5 text-sm rounded-lg bg-orange-600 hover:bg-orange-500 text-white"
            >
              Create
            </button>
          </div>
        </AppModal>
      )}

      {showDeleteModal && (
        <AppModal
          title="Delete ledger"
          subtitle={ledgerName ? `"${ledgerName}"` : undefined}
          onClose={() => setShowDeleteModal(false)}
          size="sm"
        >
          <p className="text-sm text-slate-300 mb-4">
            Permanently delete this ledger from the site? This cannot be undone. Use{' '}
            <strong className="text-white">Export JSON</strong> first if you need a copy.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="px-3 py-1.5 text-sm text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteLedger()}
              className="px-4 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white"
            >
              Delete ledger
            </button>
          </div>
        </AppModal>
      )}

      {showCloseModal && (
        <AppModal
          title="Close ledger"
          subtitle="All crew members have been paid"
          onClose={() => {
            setShowCloseModal(false)
            setCloseModalDismissed(true)
          }}
          size="sm"
        >
          <p className="text-sm text-slate-300 mb-4">
            All crew members have been paid. Click OK to close out the ledger. This will download a
            final JSON export and remove the ledger from the site.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCloseModal(false)
                setCloseModalDismissed(true)
              }}
              className="px-3 py-1.5 text-sm text-slate-400"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={() => void handleCloseConfirm()}
              className="px-4 py-1.5 text-sm rounded-lg bg-orange-600 hover:bg-orange-500 text-white"
            >
              OK
            </button>
          </div>
        </AppModal>
      )}

      {showAccessModal && detail && isLedgerCreator && (
        <AppModal
          title="Ledger access"
          subtitle="RSI-verified members only — per-ledger access"
          onClose={() => {
            setShowAccessModal(false)
            setCollabSearch('')
          }}
          size="md"
        >
          <p className="text-xs text-slate-500 mb-3">
            Collaborators can view, edit, and close this ledger. Access does not apply to other
            ledgers.
          </p>
          <label className="text-xs text-slate-400 block mb-1">Add RSI-verified member</label>
          <input
            type="text"
            value={collabSearch}
            onChange={(e) => setCollabSearch(e.target.value)}
            placeholder="Search RSI handle…"
            className="site-input w-full px-3 py-2 text-sm mb-2"
          />
          {collabOptions.length > 0 && (
            <ul className="mb-4 border border-slate-700 rounded-lg overflow-hidden bg-slate-800/40">
              {collabOptions.map((member) => {
                const label = member.rsi_handle || member.display_name || 'Unknown'
                const already = detail.collaborators.some((c) => c.user_id === member.id)
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={async () => {
                        const label = member.rsi_handle || member.display_name || 'Unknown'
                        const { error: addError } = await addCollaborator(member.id)
                        if (addError) {
                          setError(addError)
                          return
                        }
                        updateData((prev) => seedCrewMemberOnce(prev, member.id, label))
                        setCollabSearch('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700/80 hover:text-white disabled:text-slate-400 disabled:hover:bg-transparent"
                    >
                      <span className={already ? 'text-slate-400' : 'text-white'}>{label}</span>
                      {already ? (
                        <span className="text-slate-500"> (already added)</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Current access
          </h4>
          <ul className="space-y-2 text-sm">
            <li className="text-slate-100">
              {detail.creator_display ?? 'Creator'}{' '}
              <span className="text-slate-500">(creator)</span>
            </li>
            {detail.collaborators.map((collab) => (
              <li
                key={collab.user_id}
                className="flex items-center justify-between gap-2 text-slate-100"
              >
                <span className="font-medium">
                  {collab.rsi_handle || collab.display_name || collab.user_id}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const { error: removeError } = await removeCollaborator(collab.user_id)
                    if (removeError) setError(removeError)
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </li>
            ))}
            {detail.collaborators.length === 0 && (
              <li className="text-slate-500 text-xs">No collaborators yet.</li>
            )}
          </ul>
        </AppModal>
      )}
    </div>
  )
}
