import React from 'react'
import ReactDOM from 'react-dom/client'
import QueryClientProvider from './providers/QueryClientProvider'
import { AuthProvider } from './contexts/AuthContext'
import { OrderDraftProvider } from './contexts/OrderDraftContext'
import { MiningTrackerProvider } from './contexts/MiningTrackerContext'
import RouterApp from './components/RouterApp'
import DfpInitGate from './components/DfpInitGate'
import './index.css'
import { setupCacheBusting, checkAppVersion } from './lib/appVersion'

const appElement = document.getElementById('root')

if (appElement) {
  const root = ReactDOM.createRoot(appElement)

  setupCacheBusting()
  void checkAppVersion()

  root.render(
    <React.StrictMode>
      <AuthProvider>
        <MiningTrackerProvider>
          <OrderDraftProvider>
            <DfpInitGate>
              <QueryClientProvider>
                <RouterApp />
              </QueryClientProvider>
            </DfpInitGate>
          </OrderDraftProvider>
        </MiningTrackerProvider>
      </AuthProvider>
    </React.StrictMode>
  )
}
