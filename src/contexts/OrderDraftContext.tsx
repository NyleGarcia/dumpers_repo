import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'

const STORAGE_KEY = 'dumpers_order_draft'

export interface DraftOrderItem {
  cartKey: string
  blueprintId: string
  blueprintTitle: string
  slotQualities: Record<number, number>
  quantity: number
  unitDfpAuec: number
  lineDfpAuec: number
  addedAt: number
}

interface OrderDraftContextValue {
  draftItems: DraftOrderItem[]
  addToDraft: (item: Omit<DraftOrderItem, 'cartKey' | 'addedAt'>) => void
  updateDraftItem: (cartKey: string, updates: Partial<Omit<DraftOrderItem, 'cartKey' | 'addedAt'>>) => void
  removeFromDraft: (cartKey: string) => void
  clearDraft: () => void
  draftCount: number
  draftTotalDfp: number
}

const OrderDraftContext = createContext<OrderDraftContextValue | undefined>(undefined)

function generateCartKey(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function readDraftFromStorage(): DraftOrderItem[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is DraftOrderItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.cartKey === 'string' &&
        typeof item.blueprintId === 'string' &&
        typeof item.blueprintTitle === 'string' &&
        typeof item.slotQualities === 'object' &&
        typeof item.quantity === 'number' &&
        typeof item.unitDfpAuec === 'number' &&
        typeof item.lineDfpAuec === 'number' &&
        typeof item.addedAt === 'number'
    )
  } catch {
    return []
  }
}

function writeDraftToStorage(items: DraftOrderItem[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignore storage errors
  }
}

export function OrderDraftProvider({ children }: { children: React.ReactNode }) {
  const [draftItems, setDraftItems] = useState<DraftOrderItem[]>(() => readDraftFromStorage())

  useEffect(() => {
    writeDraftToStorage(draftItems)
  }, [draftItems])

  const addToDraft = useCallback((item: Omit<DraftOrderItem, 'cartKey' | 'addedAt'>) => {
    const newItem: DraftOrderItem = {
      ...item,
      cartKey: generateCartKey(),
      addedAt: Date.now(),
    }
    setDraftItems((prev) => [...prev, newItem])
  }, [])

  const updateDraftItem = useCallback(
    (cartKey: string, updates: Partial<Omit<DraftOrderItem, 'cartKey' | 'addedAt'>>) => {
      setDraftItems((prev) =>
        prev.map((item) =>
          item.cartKey === cartKey ? { ...item, ...updates } : item
        )
      )
    },
    []
  )

  const removeFromDraft = useCallback((cartKey: string) => {
    setDraftItems((prev) => prev.filter((item) => item.cartKey !== cartKey))
  }, [])

  const clearDraft = useCallback(() => {
    setDraftItems([])
  }, [])

  const draftCount = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.quantity, 0),
    [draftItems]
  )

  const draftTotalDfp = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.lineDfpAuec, 0),
    [draftItems]
  )

  const value: OrderDraftContextValue = useMemo(
    () => ({
      draftItems,
      addToDraft,
      updateDraftItem,
      removeFromDraft,
      clearDraft,
      draftCount,
      draftTotalDfp,
    }),
    [draftItems, addToDraft, updateDraftItem, removeFromDraft, clearDraft, draftCount, draftTotalDfp]
  )

  return (
    <OrderDraftContext.Provider value={value}>
      {children}
    </OrderDraftContext.Provider>
  )
}

export function useOrderDraft(): OrderDraftContextValue {
  const context = useContext(OrderDraftContext)
  if (context === undefined) {
    throw new Error('useOrderDraft must be used within an OrderDraftProvider')
  }
  return context
}
