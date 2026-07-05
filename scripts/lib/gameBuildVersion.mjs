import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const DEFAULT_SC_LIVE_PATH =
  process.env.STAR_CITIZEN_LIVE_PATH ||
  'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE'

function readJson(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Format manifest version as major.minor.x (e.g. 4.8.183.37006 -> 4.8.x).
 */
export function formatGameBuildVersion(manifestData) {
  const raw = manifestData?.Version
  if (typeof raw === 'string' && raw && raw !== 'None') {
    const [major, minor] = raw.split('.')
    if (major && minor) return `${major}.${minor}.x`
  }

  const branch = manifestData?.Branch
  if (typeof branch === 'string') {
    const match = branch.match(/(\d+)\.(\d+)/)
    if (match) return `${match[1]}.${match[2]}.x`
  }

  return null
}

/**
 * Convert a game build version string to major.minor for MIN_GAME_VERSION (e.g. 4.8.x -> 4.8).
 */
export function toMinGameVersionSecret(version) {
  if (typeof version !== 'string' || !version.trim()) return null

  const trimmed = version.trim()
  const majorMinorMatch = trimmed.match(/^(\d+)\.(\d+)/)
  if (!majorMinorMatch) return null

  return `${majorMinorMatch[1]}.${majorMinorMatch[2]}`
}

/**
 * Read the Star Citizen LIVE build version from extracted game-build.json
 * or directly from build_manifest.id in the game install folder.
 */
export function readGameBuildVersion(options = {}) {
  const extractedData = options.extractedData
  const defaultScLivePath = options.defaultScLivePath ?? DEFAULT_SC_LIVE_PATH
  const gameBuildFile = join(extractedData, 'game-build.json')

  const buildFile = readJson(gameBuildFile)
  if (buildFile) {
    if (typeof buildFile.version === 'string' && /^\d+\.\d+\.x$/.test(buildFile.version)) {
      return buildFile.version
    }
    const formatted = formatGameBuildVersion({
      Version: buildFile.internalVersion ?? buildFile.version,
      Branch: buildFile.branch,
    })
    if (formatted) return formatted
  }

  const manifestPath = join(defaultScLivePath, 'build_manifest.id')
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath)
    const formatted = formatGameBuildVersion(manifest?.Data)
    if (formatted) return formatted
  }

  return null
}

/**
 * Read game build version from committed src/data (CI / no local extraction).
 */
export function readBundledGameBuildVersion(projectRoot) {
  const versionFile = join(projectRoot, 'src', 'data', 'game-build-version.json')
  const fromVersionFile = readJson(versionFile)
  if (typeof fromVersionFile?.version === 'string' && fromVersionFile.version) {
    return fromVersionFile.version
  }

  const blueprintsFile = join(projectRoot, 'src', 'data', 'game-blueprints.json')
  const blueprints = readJson(blueprintsFile)
  if (typeof blueprints?.version === 'string' && blueprints.version) {
    return blueprints.version
  }

  return null
}

/**
 * Best available game build version: extracted install data, then bundled app data.
 */
export function resolveGameBuildVersion(options = {}) {
  const extractedData = options.extractedData
  const projectRoot = options.projectRoot ?? (extractedData ? join(extractedData, '..') : process.cwd())
  return readGameBuildVersion(options) ?? readBundledGameBuildVersion(projectRoot)
}
