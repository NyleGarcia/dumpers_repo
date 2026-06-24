/**
 * Build locationAliases from extracted localization + HPP audit.
 * Used by parse-extracted-data.mjs and parseMiningSpawns.mjs.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, basename } from 'path'

/** Spawn code → primary compendium / guide name (from localization + compendium). */
export const SPAWN_CODE_GUIDE_NAMES = {
  Stanton1: 'Hurston',
  Stanton1a: 'Ita',
  Stanton1b: 'Aberdeen',
  Stanton1c: 'Arial',
  Stanton1d: 'Magda',
  Stanton2a: 'Cellin',
  Stanton2b: 'Daymar',
  Stanton2c: 'Yela',
  'Stanton2c Belt': 'Yela Ring',
  Stanton3a: 'Lyria',
  Stanton3b: 'Wala',
  Stanton4: 'microTech',
  Stanton4a: 'Calliope',
  Stanton4b: 'Clio',
  Stanton4c: 'Euterpe',
  Pyro1: 'Pyro I',
  Pyro2: 'Pyro II',
  Pyro3: 'Bloom',
  Pyro4: 'Pyro IV',
  Pyro6: 'Terminus',
  Pyro5a: 'Ignis',
  Pyro5b: 'Vatra',
  Pyro5c: 'Adir',
  Pyro5d: 'Fairo',
  Pyro5e: 'Fuego',
  Pyro5f: 'Vuur',
  'Aaron Halo': 'Aaron Halo',
  'Akiro Cluster': 'Akiro Cluster',
  'Glaciem Ring': 'Glaciem Ring',
  'Keeger Belt': 'Keeger Belt',
}

/** Compendium Lagrange station → internal belt template (ore-overlap verified). */
export const GUIDE_TO_SPAWN_KEYS = {
  'ARC-L1': ['Lagrange F'],
  'ARC-L2': ['Lagrange F'],
  'ARC-L3': ['Lagrange D'],
  'ARC-L4': ['Lagrange F'],
  'ARC-L5': ['Lagrange B'],
  'CRU-L1': ['Lagrange E'],
  'CRU-L2': ['Lagrange E'],
  'CRU-L3': ['Lagrange C'],
  'CRU-L4': ['Lagrange B'],
  'CRU-L5': ['Lagrange D'],
  'HUR-L1': ['Lagrange A'],
  'HUR-L2': ['Lagrange F'],
  'HUR-L3': ['Lagrange E'],
  'HUR-L4': ['Lagrange A'],
  'HUR-L5': ['Lagrange A'],
  'MIC-L1': ['Lagrange C'],
  'MIC-L2': ['Lagrange C'],
  'MIC-L3': ['Lagrange B'],
  'MIC-L4': ['Lagrange D'],
  'MIC-L5': ['Lagrange C'],
}

function pyrLagrangeNames(planetNum) {
  return [1, 2, 3, 4, 5].map((n) => `PYR${planetNum} L${n}`)
}

/**
 * HPP belt templates → starmap Lagrange site names.
 * Verified from game location→preset assignments (Warm = inner belts, Cool = outer).
 */
export const SPAWN_TEMPLATE_SITE_GUIDE_NAMES = {
  'Pyro Warm01': [...pyrLagrangeNames(1), ...pyrLagrangeNames(2)],
  'Pyro Warm02': pyrLagrangeNames(3),
  'Pyro Cool01': pyrLagrangeNames(5),
  'Pyro Cool02': pyrLagrangeNames(6),
}

/** Member-facing labels for internal belt/body templates (never Warm01/Cool02 slugs). */
export const SPAWN_TEMPLATE_DISPLAY_NAMES = {
  'Pyro Warm01': 'Pyro I–II Lagrange belts',
  'Pyro Warm02': 'Pyro III Lagrange belts',
  'Pyro Cool01': 'Pyro V Lagrange belts',
  'Pyro Cool02': 'Pyro VI Lagrange belts',
  'Pyro Deepspaceasteroids': 'Pyro Asteroid Clusters',
}

const SPAWN_KEY_SKIP_DESC_SUFFIXES = new Set([
  'Outpost',
  'ASD',
  'Delving',
  'Facility',
  'Cave',
  'MiningCompound',
  'OLP',
  'HurDyn',
  'ArcCorp',
  'DrugLab',
  'DrugUGF',
  'IndyMine',
  'Racetrack',
  'Stash',
  'Prison',
  'JPStation',
  'entrance',
])

/** Explicit HPP slug → canonical spawnKey (matches legacy game-mining-spawns.json). */
const HPP_CANONICAL_SPAWN_KEYS = {
  AaronHalo: 'Aaron Halo',
  Pyro_AkiroCluster: 'Akiro Cluster',
  Nyx_GlaciemRing: 'Glaciem Ring',
  Nyx_KeegerBelt: 'Keeger Belt',
  Pyro_DeepSpaceAsteroids: 'Pyro Deepspaceasteroids',
  Pyro_Warm01: 'Pyro Warm01',
  Pyro_Warm02: 'Pyro Warm02',
  Pyro_Cool01: 'Pyro Cool01',
  Pyro_Cool02: 'Pyro Cool02',
  Stanton2c_Belt: 'Stanton2c Belt',
  Lagrange_A: 'Lagrange A',
  Lagrange_B: 'Lagrange B',
  Lagrange_C: 'Lagrange C',
  Lagrange_D: 'Lagrange D',
  Lagrange_E: 'Lagrange E',
  Lagrange_F: 'Lagrange F',
  Lagrange_G: 'Lagrange G',
  Lagrange_Occupied: 'Lagrange Occupied',
}

function splitCamelCaseToken(token) {
  return token
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** Normalize HPP record name to spawnKey (matches legacy game-mining-spawns.json). */
export function hppRecordToSpawnKey(hppRecordName) {
  const raw = String(hppRecordName || '').replace(/^HarvestableProviderPreset\.HPP_/i, '')
  if (HPP_CANONICAL_SPAWN_KEYS[raw]) return HPP_CANONICAL_SPAWN_KEYS[raw]

  if (/^(Stanton|Pyro)\d+[a-f]?$/i.test(raw)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  if (!raw.includes('_')) {
    return splitCamelCaseToken(raw).join(' ')
  }

  return raw
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

export function inferSystemFromSpawnKey(spawnKey) {
  if (!spawnKey) return 'Unknown'
  if (/^Pyro/i.test(spawnKey)) return 'Pyro'
  if (/^Stanton|^Lagrange|^Aaron Halo/i.test(spawnKey)) return 'Stanton'
  if (/^Nyx|^Glaciem|^Keeger/i.test(spawnKey)) return 'Nyx'
  return 'Unknown'
}

/**
 * Parse localization desc key into spawn code + optional guide name.
 * @param {string} key e.g. Stanton1b_Aberdeen_desc, Pyro1_desc, Pyro5c_Adir_desc
 */
export function parseLocationDescKey(key) {
  if (!/_desc$/i.test(key)) return null
  const base = key.replace(/_desc$/i, '')
  const parts = base.split('_')
  const head = parts[0]
  if (!/^(Stanton|Pyro|Nyx)\d/i.test(head)) return null

  const spawnKey = head
  let guideName = null

  if (parts.length >= 2) {
    const tailParts = parts.slice(1)
    const tail = tailParts.join('_')
    const skip = [...SPAWN_KEY_SKIP_DESC_SUFFIXES].some((s) => tail.includes(s))
    if (!skip && tailParts.length === 1 && /^[A-Z][a-zA-Z]+$/.test(tail)) {
      guideName = tail
    }
  }

  return {
    spawnKey,
    guideName,
    system: inferSystemFromSpawnKey(spawnKey),
  }
}

function buildSpawnKeyToGuideNames() {
  const map = new Map()
  for (const [guideName, spawnKeys] of Object.entries(GUIDE_TO_SPAWN_KEYS)) {
    for (const spawnKey of spawnKeys) {
      if (!map.has(spawnKey)) map.set(spawnKey, new Set())
      map.get(spawnKey).add(guideName)
    }
  }
  for (const [spawnKey, guideName] of Object.entries(SPAWN_CODE_GUIDE_NAMES)) {
    if (!map.has(spawnKey)) map.set(spawnKey, new Set())
    map.get(spawnKey).add(guideName)
  }
  for (const [spawnKey, siteNames] of Object.entries(SPAWN_TEMPLATE_SITE_GUIDE_NAMES)) {
    if (!map.has(spawnKey)) map.set(spawnKey, new Set())
    const set = map.get(spawnKey)
    set.add('Pyro Asteroid Clusters')
    for (const name of siteNames) set.add(name)
  }
  return map
}

const SPAWN_TO_GUIDE_NAMES = buildSpawnKeyToGuideNames()

function lagrangeDisplayName(spawnKey, guideNames) {
  if (guideNames?.length) return [...guideNames].sort()[0]
  const letter = spawnKey.replace(/^Lagrange\s+/i, '')
  if (letter === 'Occupied') return 'Occupied Lagrange belt'
  return `Aaron Halo belt · ${letter}`
}

function resolveDisplayName(spawnKey, guideName, guideNames) {
  if (SPAWN_TEMPLATE_DISPLAY_NAMES[spawnKey]) return SPAWN_TEMPLATE_DISPLAY_NAMES[spawnKey]
  if (guideName && (!guideNames || guideNames.length <= 1)) return guideName
  if (guideNames?.length === 1) return guideNames[0]
  if (/^Lagrange/i.test(spawnKey)) return lagrangeDisplayName(spawnKey, guideNames)
  if (guideNames?.length > 1) return guideNames[0]
  return spawnKey
}

function upsertAlias(map, spawnKey, patch) {
  const existing = map.get(spawnKey) ?? { spawnKey }
  map.set(spawnKey, { ...existing, ...patch, spawnKey })
}

/**
 * Build locationAliases map keyed by spawnKey.
 * @param {Record<string, string>} localization
 * @param {string} extractedDataRoot
 */
export function buildLocationAliases(localization, extractedDataRoot) {
  const aliases = new Map()

  for (const [key, value] of Object.entries(localization)) {
    if (key === '_lowerMap') continue
    if (!value.includes('Potential')) continue
    const parsed = parseLocationDescKey(key)
    if (!parsed) continue
    const guideName = parsed.guideName ?? SPAWN_CODE_GUIDE_NAMES[parsed.spawnKey] ?? null
    const guideNames = SPAWN_TO_GUIDE_NAMES.get(parsed.spawnKey)
      ? [...SPAWN_TO_GUIDE_NAMES.get(parsed.spawnKey)]
      : guideName
        ? [guideName]
        : undefined
    upsertAlias(aliases, parsed.spawnKey, {
      guideName: guideName ?? undefined,
      guideNames,
      displayName: resolveDisplayName(parsed.spawnKey, guideName, guideNames),
      system: parsed.system,
      source: 'localization_desc',
    })
  }

  for (const [spawnKey, guideName] of Object.entries(SPAWN_CODE_GUIDE_NAMES)) {
    if (aliases.has(spawnKey)) continue
    const guideNames = SPAWN_TO_GUIDE_NAMES.get(spawnKey)
      ? [...SPAWN_TO_GUIDE_NAMES.get(spawnKey)]
      : [guideName]
    upsertAlias(aliases, spawnKey, {
      guideName,
      guideNames,
      displayName: resolveDisplayName(spawnKey, guideName, guideNames),
      system: inferSystemFromSpawnKey(spawnKey),
      source: 'spawn_code_table',
    })
  }

  applyVerifiedOverlays(aliases)
  auditHppProviderPresets(extractedDataRoot, aliases)

  return Object.fromEntries(
    [...aliases.entries()].sort(([a], [b]) => a.localeCompare(b))
  )
}

function applyVerifiedOverlays(aliases) {
  for (const [spawnKey, siteNames] of Object.entries(SPAWN_TEMPLATE_SITE_GUIDE_NAMES)) {
    upsertAlias(aliases, spawnKey, {
      guideNames: ['Pyro Asteroid Clusters', ...siteNames],
      displayName: SPAWN_TEMPLATE_DISPLAY_NAMES[spawnKey] ?? spawnKey,
      system: 'Pyro',
      source: 'verified_overlay',
    })
  }

  upsertAlias(aliases, 'Pyro Deepspaceasteroids', {
    guideNames: ['Pyro Asteroid Clusters'],
    displayName: SPAWN_TEMPLATE_DISPLAY_NAMES['Pyro Deepspaceasteroids'],
    system: 'Pyro',
    source: 'verified_overlay',
  })

  for (const spawnKey of [
    'Lagrange A',
    'Lagrange B',
    'Lagrange C',
    'Lagrange D',
    'Lagrange E',
    'Lagrange F',
    'Lagrange G',
    'Lagrange Occupied',
  ]) {
    const guideNames = SPAWN_TO_GUIDE_NAMES.get(spawnKey)
      ? [...SPAWN_TO_GUIDE_NAMES.get(spawnKey)].sort()
      : undefined
    upsertAlias(aliases, spawnKey, {
      guideNames,
      displayName: lagrangeDisplayName(spawnKey, guideNames),
      system: 'Stanton',
      source: 'verified_overlay',
    })
  }
}

function walkJsonFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walkJsonFiles(p, acc)
    else if (entry.name.endsWith('.json')) acc.push(p)
  }
  return acc
}

/** Ensure every HPP preset has an alias entry; enrich system from file path. */
function auditHppProviderPresets(extractedDataRoot, aliases) {
  const hppDir = join(extractedDataRoot, 'libs/foundry/records/harvestable/providerpresets')
  for (const file of walkJsonFiles(hppDir)) {
    if (!basename(file).startsWith('hpp_')) continue
    const json = JSON.parse(readFileSync(file, 'utf-8'))
    const spawnKey = hppRecordToSpawnKey(json._RecordName_ || basename(file, '.json'))
    const pathLower = file.replace(/\\/g, '/').toLowerCase()
    const system = pathLower.includes('/pyro/')
      ? 'Pyro'
      : pathLower.includes('/stanton/')
        ? 'Stanton'
        : pathLower.includes('/nyx/')
          ? 'Nyx'
          : inferSystemFromSpawnKey(spawnKey)

    if (!aliases.has(spawnKey)) {
      const guideName = SPAWN_CODE_GUIDE_NAMES[spawnKey]
      const guideNames = SPAWN_TO_GUIDE_NAMES.get(spawnKey)
        ? [...SPAWN_TO_GUIDE_NAMES.get(spawnKey)]
        : guideName
          ? [guideName]
          : undefined
      upsertAlias(aliases, spawnKey, {
        guideName,
        guideNames,
        displayName: resolveDisplayName(spawnKey, guideName, guideNames),
        system,
        source: 'hpp_path_audit',
      })
    } else {
      const entry = aliases.get(spawnKey)
      if (entry.system === 'Unknown' && system !== 'Unknown') {
        entry.system = system
      }
      if (typeof entry.source === 'string' && !entry.source.includes('hpp')) {
        entry.source = `${entry.source}+hpp_path_audit`
      }
    }
  }
}

export function resolveAliasForSpawnKey(spawnKey, locationAliases = {}) {
  const alias = locationAliases[spawnKey]
  if (alias) {
    return {
      spawnKey,
      displayName: alias.displayName ?? spawnKey,
      guideName: alias.guideName ?? alias.guideNames?.[0],
      guideNames: alias.guideNames,
      system: alias.system ?? inferSystemFromSpawnKey(spawnKey),
    }
  }
  const guideName = SPAWN_CODE_GUIDE_NAMES[spawnKey]
  const guideNames = SPAWN_TO_GUIDE_NAMES.get(spawnKey)
    ? [...SPAWN_TO_GUIDE_NAMES.get(spawnKey)]
    : undefined
  return {
    spawnKey,
    displayName: resolveDisplayName(spawnKey, guideName, guideNames),
    guideName,
    guideNames,
    system: inferSystemFromSpawnKey(spawnKey),
  }
}

/** Audit spawn JSON keys against locationAliases. */
export function auditAliasCoverage(spawnKeys, locationAliases) {
  const unmapped = []
  const rawDisplayNames = []
  for (const spawnKey of spawnKeys) {
    const alias = locationAliases[spawnKey]
    if (!alias?.displayName) {
      unmapped.push(spawnKey)
      continue
    }
    const looksLikeRawSlug =
      /^(Stanton\d|Pyro\d|Lagrange [A-G])$/i.test(alias.displayName) &&
      alias.source !== 'verified_overlay'
    if (
      (alias.displayName === spawnKey && /^(Stanton|Pyro)\d/i.test(spawnKey)) ||
      looksLikeRawSlug
    ) {
      if (alias.source !== 'verified_overlay') {
        rawDisplayNames.push({ spawnKey, displayName: alias.displayName, source: alias.source })
      }
    }
  }

  return { unmapped, rawDisplayNames }
}
