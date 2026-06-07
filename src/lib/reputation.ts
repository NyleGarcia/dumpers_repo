import { REPUTATION_MIN_COMPLETED } from '../config/reputation'

export interface MemberReputation {
  completedCount: number
  ratingCount: number
  score: number | null
  isPending: boolean
}

export interface MemberReputationRow {
  user_id: string
  buyer_completed_count: number
  buyer_rating_count: number
  buyer_reputation: number | null
  buyer_is_pending: boolean
  fulfiller_completed_count: number
  fulfiller_rating_count: number
  fulfiller_reputation: number | null
  fulfiller_is_pending: boolean
}

export function buyerReputationFromRow(row: MemberReputationRow | undefined): MemberReputation {
  if (!row) return emptyReputation()
  return {
    completedCount: row.buyer_completed_count,
    ratingCount: row.buyer_rating_count,
    score: row.buyer_reputation,
    isPending: row.buyer_is_pending,
  }
}

export function fulfillerReputationFromRow(row: MemberReputationRow | undefined): MemberReputation {
  if (!row) return emptyReputation()
  return {
    completedCount: row.fulfiller_completed_count,
    ratingCount: row.fulfiller_rating_count,
    score: row.fulfiller_reputation,
    isPending: row.fulfiller_is_pending,
  }
}

export function emptyReputation(): MemberReputation {
  return {
    completedCount: 0,
    ratingCount: 0,
    score: null,
    isPending: true,
  }
}

export function formatReputationLabel(rep: MemberReputation): string {
  if (rep.isPending || rep.score == null) {
    const remaining = Math.max(0, REPUTATION_MIN_COMPLETED - rep.completedCount)
    if (remaining > 0) {
      return `Pending (${rep.completedCount}/${REPUTATION_MIN_COMPLETED})`
    }
    return 'Pending'
  }
  return String(rep.score)
}

export function passesBuyerRepFilter(
  buyerRep: MemberReputation,
  minFilter: number | null
): boolean {
  if (!minFilter || minFilter < 1) return true
  if (buyerRep.isPending || buyerRep.score == null) return true
  return buyerRep.score >= minFilter
}

export function fulfillerMeetsOrderMinRep(
  fulfillerRep: MemberReputation,
  orderMin: number | null | undefined
): boolean {
  if (orderMin == null || orderMin < 1) return true
  if (fulfillerRep.isPending || fulfillerRep.score == null) return true
  return fulfillerRep.score >= orderMin
}
