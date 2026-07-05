import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import dotenv from 'dotenv'
import { readGameBuildVersion, toMinGameVersionSecret } from './gameBuildVersion.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..')
const SECRET_NAME = 'MIN_GAME_VERSION'

export function loadProjectEnv() {
  dotenv.config({ path: join(PROJECT_ROOT, '.env') })
  dotenv.config({ path: join(PROJECT_ROOT, '.env.local') })
}

export function resolveSupabaseProjectRef(env = process.env) {
  if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF

  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] ?? null
}

async function fetchCurrentSecretValue(projectRef, accessToken) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const secrets = await response.json()
  if (!Array.isArray(secrets)) return null

  const existing = secrets.find((entry) => entry?.name === SECRET_NAME)
  return typeof existing?.value === 'string' ? existing.value : null
}

/**
 * Push major.minor game version to the log-watcher MIN_GAME_VERSION Supabase secret.
 * Skips gracefully when credentials are missing or sync is disabled.
 */
export async function syncMinGameVersionSecret(version, options = {}) {
  const minVersion = toMinGameVersionSecret(version)
  if (!minVersion) {
    console.warn('  ⚠ Skipping MIN_GAME_VERSION sync: no major.minor version available')
    return { skipped: true, reason: 'no-version' }
  }

  if (process.env.SKIP_SUPABASE_SECRET_SYNC === '1') {
    console.log('  Skipping MIN_GAME_VERSION sync (SKIP_SUPABASE_SECRET_SYNC=1)')
    return { skipped: true, reason: 'disabled', minVersion }
  }

  const projectRef = resolveSupabaseProjectRef()
  if (!projectRef) {
    console.warn('  ⚠ Skipping MIN_GAME_VERSION sync: set SUPABASE_PROJECT_REF or VITE_SUPABASE_URL')
    return { skipped: true, reason: 'no-project-ref', minVersion }
  }

  if (options.dryRun) {
    console.log(`  [dry-run] Would set ${SECRET_NAME}=${minVersion} on project ${projectRef}`)
    return { dryRun: true, minVersion, projectRef }
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  if (!accessToken) {
    console.warn(
      '  ⚠ Skipping MIN_GAME_VERSION sync: set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)'
    )
    return { skipped: true, reason: 'no-token', minVersion }
  }

  if (!options.force) {
    const currentValue = await fetchCurrentSecretValue(projectRef, accessToken)
    if (currentValue === minVersion) {
      console.log(`  ✓ Supabase ${SECRET_NAME} already ${minVersion}`)
      return { unchanged: true, minVersion, projectRef }
    }
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ name: SECRET_NAME, value: minVersion }]),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.warn(`  ⚠ MIN_GAME_VERSION sync failed (${response.status}): ${errorText.trim()}`)
    return { failed: true, minVersion, projectRef, status: response.status, error: errorText }
  }

  console.log(`  ✓ Supabase ${SECRET_NAME} set to ${minVersion}`)
  return { synced: true, minVersion, projectRef }
}

async function runCli() {
  loadProjectEnv()

  const extractedData = join(PROJECT_ROOT, 'extracted-data')
  const version =
    process.argv.find((arg) => /^\d+\.\d+(\.x)?$/.test(arg)) ??
    readGameBuildVersion({ extractedData })

  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')

  const result = await syncMinGameVersionSecret(version, { dryRun, force })
  if (result.failed) {
    process.exit(1)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  runCli().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
