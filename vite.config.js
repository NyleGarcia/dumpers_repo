import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildId = process.env.VITE_BUILD_ID || process.env.GITHUB_SHA?.slice(0, 7) || 'dev'

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  },
})
