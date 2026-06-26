import { pricingForResourceLine } from './orderPricing'

export const MINING_LEDGER_SCHEMA_VERSION = 1 as const
export const MINING_LEDGER_YIELD_FACTOR = 0.45
/** Ledger ore defaults always use store-purchased Q0 DFP (no quality picker). */
export const MINING_LEDGER_PRICE_QUALITY = 0 as const
export const CSCU_PER_SCU = 100

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

/** Manual price per 100 SCU of refined yield; omit pricePer100 to use Purchased Q0 DFP default. */
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

/** Yield is in cSCU; pricePer100Scu is aUEC per 100 SCU of refined yield. */
export function profitFromYieldCscu(yieldCscu: number, pricePer100Scu: number): number {
  if (!Number.isFinite(yieldCscu) || !Number.isFinite(pricePer100Scu)) return 0
  return (yieldCscu / CSCU_PER_SCU / 100) * pricePer100Scu
}

export function defaultPricePer100(resourceKey: string, resourceLabel: string): number {
  const { unitDfpAuec } = pricingForResourceLine(
    resourceKey,
    resourceLabel,
    MINING_LEDGER_PRICE_QUALITY,
    1
  )
  return unitDfpAuec * 100
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

  const totalShares = data.crew.reduce(
    (sum, member) => sum + (Number.isFinite(member.shares) ? member.shares : 0),
    0
  )

  const crew: CrewMemberComputed[] = data.crew.map((member) => {
    const shares = Number.isFinite(member.shares) ? member.shares : 0
    const payoutEstimate =
      totalShares > 0 ? (poolEstimate / totalShares) * shares : 0
    const payoutActual = totalShares > 0 ? (poolActual / totalShares) * shares : 0
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
