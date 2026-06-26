import { pricingForResourceLine } from './orderPricing'

export const MINING_LEDGER_SCHEMA_VERSION = 1 as const
export const MINING_LEDGER_YIELD_FACTOR = 0.45
/** Ledger ore defaults always use store-purchased Q0 DFP (no quality picker). */
export const MINING_LEDGER_PRICE_QUALITY = 0 as const

export interface MiningLedgerMiningRow {
  id: string
  resourceKey: string
  resourceLabel: string
  quality: number
  unrefinedCscu: number
  /** When set, used instead of estimated yield for actual profit column. */
  yieldActual: number | null
}

export interface MiningLedgerDeductible {
  id: string
  label: string
  cost: number
}

export interface MiningLedgerOtherProfit {
  id: string
  extra: string
  profit: number
}

/** Manual price per 100 cSCU of refined yield; omit pricePer100 to use Purchased Q0 DFP default. */
export interface MiningLedgerPriceOverride {
  resourceKey: string
  resourceLabel: string
  pricePer100: number | null
}

export interface MiningLedgerCrewMember {
  id: string
  playerName: string
  /** Set when matched to a verified site member (autocomplete or RSI lookup). */
  linkedUserId: string | null
  shares: number
  role: string
  isPaid: boolean
  /** Payout actual at time paid (used for notifications and export). */
  paidPayoutAuec: number | null
}

export type { CrewRsiAlertState } from './rsiHandleCheck'
export {
  CREW_RSI_INVALID_HANDLE_TOOLTIP,
  CREW_RSI_VALID_NOT_REGISTERED_TOOLTIP,
  CREW_RSI_VERIFIED_MEMBER_TOOLTIP,
} from './rsiHandleCheck'

/** @deprecated Use CREW_RSI_VALID_NOT_REGISTERED_TOOLTIP */
export { CREW_RSI_VALID_NOT_REGISTERED_TOOLTIP as UNKNOWN_CREW_MEMBER_TOOLTIP } from './rsiHandleCheck'

export interface MiningLedgerData {
  schemaVersion: typeof MINING_LEDGER_SCHEMA_VERSION
  /** Site user IDs already auto-added to crew once (creator + access grants). */
  seededCrewUserIds: string[]
  miningRows: MiningLedgerMiningRow[]
  deductibles: MiningLedgerDeductible[]
  otherProfits: MiningLedgerOtherProfit[]
  priceOverrides: MiningLedgerPriceOverride[]
  crew: MiningLedgerCrewMember[]
}

export interface MiningRowComputed {
  id: string
  resourceKey: string
  resourceLabel: string
  quality: number
  unrefinedCscu: number
  yieldEstimate: number
  yieldActual: number
  profitEstimate: number
  profitActual: number
  pricePer100: number
}

export interface CrewMemberComputed {
  id: string
  playerName: string
  shares: number
  role: string
  isPaid: boolean
  payoutEstimate: number
  payoutActual: number
  outstandingEstimate: number
  outstandingActual: number
}

export interface MiningLedgerComputed {
  miningRows: MiningRowComputed[]
  pivotProfitEstimate: number
  pivotProfitActual: number
  /** Sum of mining run profit actual — split by shares for crew payout actual. */
  totalPayout: number
  deductibleTotal: number
  otherProfitTotal: number
  poolEstimate: number
  poolActual: number
  totalShares: number
  crew: CrewMemberComputed[]
  allCrewPaid: boolean
}

export interface MiningLedgerListItem {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
  creator_display: string | null
}

export interface MiningLedgerCollaborator {
  user_id: string
  rsi_handle: string | null
  display_name: string | null
  added_at: string
}

export interface MiningLedgerDetail extends MiningLedgerListItem {
  data: MiningLedgerData
  collaborators: MiningLedgerCollaborator[]
}

export function newLedgerRowId(): string {
  return crypto.randomUUID()
}

export function createEmptyMiningLedgerData(): MiningLedgerData {
  return {
    schemaVersion: MINING_LEDGER_SCHEMA_VERSION,
    seededCrewUserIds: [],
    miningRows: [],
    deductibles: [{ id: newLedgerRowId(), label: 'Refining', cost: 0 }],
    otherProfits: [],
    priceOverrides: [],
    crew: [],
  }
}

export function yieldEstimateFromUnrefined(unrefinedCscu: number): number {
  return Math.round(unrefinedCscu * MINING_LEDGER_YIELD_FACTOR)
}

/**
 * Spreadsheet formula: profit = (yield / 100) × price.
 * Yield is cSCU; price is aUEC per 100 cSCU of refined yield (column labels said SCU, math is cSCU).
 */
export function profitFromYieldCscu(yieldCscu: number, pricePer100Cscu: number): number {
  if (!Number.isFinite(yieldCscu) || !Number.isFinite(pricePer100Cscu)) return 0
  return (yieldCscu / 100) * pricePer100Cscu
}

/** Purchased Q0 DFP for 100 cSCU of yield (= 1 SCU). */
export function defaultPricePer100(resourceKey: string, resourceLabel: string): number {
  const { unitDfpAuec } = pricingForResourceLine(
    resourceKey,
    resourceLabel,
    MINING_LEDGER_PRICE_QUALITY,
    1
  )
  return unitDfpAuec
}

export function resolvePricePer100(
  resourceKey: string,
  resourceLabel: string,
  overrides: MiningLedgerPriceOverride[]
): number {
  const override = overrides.find((row) => row.resourceKey === resourceKey)
  if (override?.pricePer100 != null && Number.isFinite(override.pricePer100)) {
    return override.pricePer100
  }
  return defaultPricePer100(resourceKey, resourceLabel)
}

/** Add a verified site member to crew once per ledger (creator or access grant). */
export function seedCrewMemberOnce(
  data: MiningLedgerData,
  userId: string,
  playerName: string
): MiningLedgerData {
  const seeded = data.seededCrewUserIds ?? []
  if (seeded.includes(userId)) return data

  const alreadyOnCrew = data.crew.some((member) => member.linkedUserId === userId)
  const nextSeeded = [...seeded, userId]

  if (alreadyOnCrew) {
    return { ...data, seededCrewUserIds: nextSeeded }
  }

  return {
    ...data,
    seededCrewUserIds: nextSeeded,
    crew: [
      ...data.crew,
      {
        id: newLedgerRowId(),
        playerName,
        linkedUserId: userId,
        shares: 1,
        role: '',
        isPaid: false,
        paidPayoutAuec: null,
      },
    ],
  }
}

export function computeMiningLedger(data: MiningLedgerData): MiningLedgerComputed {
  const miningRows: MiningRowComputed[] = data.miningRows.map((row) => {
    const yieldEst = yieldEstimateFromUnrefined(row.unrefinedCscu)
    const yieldAct = row.yieldActual ?? yieldEst
    const pricePer100 = resolvePricePer100(
      row.resourceKey,
      row.resourceLabel,
      data.priceOverrides
    )
    return {
      id: row.id,
      resourceKey: row.resourceKey,
      resourceLabel: row.resourceLabel,
      quality: row.quality,
      unrefinedCscu: row.unrefinedCscu,
      yieldEstimate: yieldEst,
      yieldActual: yieldAct,
      profitEstimate: profitFromYieldCscu(yieldEst, pricePer100),
      profitActual: profitFromYieldCscu(yieldAct, pricePer100),
      pricePer100,
    }
  })

  const pivotProfitEstimate = miningRows.reduce((sum, row) => sum + row.profitEstimate, 0)
  const pivotProfitActual = miningRows.reduce((sum, row) => sum + row.profitActual, 0)

  const deductibleTotal = data.deductibles.reduce(
    (sum, row) => sum + (Number.isFinite(row.cost) ? row.cost : 0),
    0
  )
  const otherProfitTotal = data.otherProfits.reduce(
    (sum, row) => sum + (Number.isFinite(row.profit) ? row.profit : 0),
    0
  )

  const poolEstimate = -deductibleTotal + pivotProfitEstimate + otherProfitTotal
  const poolActual = -deductibleTotal + pivotProfitActual + otherProfitTotal

  const totalPayout = pivotProfitActual

  const totalShares = data.crew.reduce(
    (sum, member) => sum + (Number.isFinite(member.shares) ? member.shares : 0),
    0
  )

  const crew: CrewMemberComputed[] = data.crew.map((member) => {
    const shares = Number.isFinite(member.shares) ? member.shares : 0
    const payoutEstimate =
      totalShares > 0 ? (poolEstimate / totalShares) * shares : 0
    const payoutActual =
      totalShares > 0 ? (totalPayout / totalShares) * shares : 0
    return {
      id: member.id,
      playerName: member.playerName,
      shares,
      role: member.role,
      isPaid: member.isPaid,
      payoutEstimate,
      payoutActual,
      outstandingEstimate: member.isPaid ? 0 : payoutEstimate,
      outstandingActual: member.isPaid ? 0 : payoutActual,
    }
  })

  const allCrewPaid =
    data.crew.length > 0 && data.crew.every((member) => member.isPaid)

  return {
    miningRows,
    pivotProfitEstimate,
    pivotProfitActual,
    totalPayout,
    deductibleTotal,
    otherProfitTotal,
    poolEstimate,
    poolActual,
    totalShares,
    crew,
    allCrewPaid,
  }
}

export interface MiningLedgerExportPayload {
  exportedAt: string
  ledger: {
    id: string
    name: string
    orePriceQuality: typeof MINING_LEDGER_PRICE_QUALITY
  }
  computed: Omit<MiningLedgerComputed, 'crew'> & {
    crew: Omit<CrewMemberComputed, 'isPaid'>[]
  }
  data: Omit<MiningLedgerData, 'crew'> & {
    crew: Omit<MiningLedgerCrewMember, 'isPaid'>[]
  }
}

export function buildLedgerExportJson(
  ledgerId: string,
  ledgerName: string,
  data: MiningLedgerData,
  computed: MiningLedgerComputed
): MiningLedgerExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    ledger: {
      id: ledgerId,
      name: ledgerName,
      orePriceQuality: MINING_LEDGER_PRICE_QUALITY,
    },
    computed: {
      ...computed,
      crew: computed.crew.map(({ isPaid: _isPaid, ...rest }) => rest),
    },
    data: {
      ...data,
      crew: data.crew.map(({ isPaid: _isPaid, ...rest }) => rest),
    },
  }
}

export function downloadLedgerJson(payload: MiningLedgerExportPayload, fileName: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function copyPayoutAmount(value: number): Promise<void> {
  const text = String(Math.round(value))
  return navigator.clipboard.writeText(text)
}

export function formatLedgerMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(value).toLocaleString()} aUEC`
}

export function shortLedgerId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}
