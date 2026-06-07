import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildId = process.env.VITE_BUILD_ID || process.env.GITHUB_SHA?.slice(0, 7) || `local-${Date.now()}`

mkdirSync(join(root, 'dist'), { recursive: true })
writeFileSync(
  join(root, 'dist', 'version.json'),
  JSON.stringify({ buildId }, null, 2)
)

console.log(`Wrote dist/version.json (buildId: ${buildId})`)
