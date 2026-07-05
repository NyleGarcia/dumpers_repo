import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import BpDumperModal from '../components/bpDumper/BpDumperModal'

type BpDumperModalContextValue = {
  openBpDumperModal: () => void
  closeBpDumperModal: () => void
}

const BpDumperModalContext = createContext<BpDumperModalContextValue | null>(null)

export function BpDumperModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openBpDumperModal = useCallback(() => setOpen(true), [])
  const closeBpDumperModal = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ openBpDumperModal, closeBpDumperModal }),
    [openBpDumperModal, closeBpDumperModal]
  )

  return (
    <BpDumperModalContext.Provider value={value}>
      {children}
      {open && <BpDumperModal onClose={closeBpDumperModal} />}
    </BpDumperModalContext.Provider>
  )
}

export function useBpDumperModal(): BpDumperModalContextValue {
  const ctx = useContext(BpDumperModalContext)
  if (!ctx) {
    throw new Error('useBpDumperModal must be used within BpDumperModalProvider')
  }
  return ctx
}
