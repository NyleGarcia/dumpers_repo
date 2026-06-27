#!/usr/bin/env node
/**
 * Find extracted-data references to orphan blueprint reward pools
 * (pools in missionBlueprints with no contractgenerator link).
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXTRACTED_DATA = join(root, 'extracted-data')
const missionData = JSON.parse(readFileSync(join(root, 'src/data/game-blueprint-missions.json'), 'utf-8'))

const { missionBlueprints, contracts } = missionData

const linkedPoolKeys = new Set()
for (const contract of contracts) {
  for (const pool of contract.blueprintPools || []) {
    linkedPoolKeys.add(pool.key)
  }
}

const orphanPools = Object.keys(missionBlueprints).filter((key) => !linkedPoolKeys.has(key))
console.log(`Orphan pools: ${orphanPools.length} / ${Object.keys(missionBlueprints).length}`)

function poolSearchTerms(poolKey) {
  const terms = new Set([poolKey.toLowerCase()])
  terms.add(poolKey.replace(/_/g, '').toLowerCase())
  terms.add(`bp_missionreward_${poolKey}`.toLowerCase())
  terms.add(`bp_rewards_${poolKey}`.toLowerCase())
  terms.add(`blueprintpoolrecord.${poolKey}`.toLowerCase())
  // PascalCase variants for game record names
  const pascal = poolKey
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  terms.add(`bp_missionreward_${pascal}`.toLowerCase())
  terms.add(pascal.toLowerCase())
  return [...terms]
}

const poolTerms = new Map()
for (const poolKey of orphanPools) {
  poolTerms.set(poolKey, poolSearchTerms(poolKey))
}

function walkJsonFiles(dir, files = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkJsonFiles(full, files)
    } else if (entry.name.endsWith('.json')) {
      files.push(full)
    }
  }
  return files
}

function findJsonPaths(obj, path = '', hits = []) {
  if (obj == null) return hits
  if (typeof obj === 'string') {
    hits.push({ path, value: obj })
    return hits
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => findJsonPaths(item, `${path}[${i}]`, hits))
    return hits
  }
  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      const nextPath = path ? `${path}.${key}` : key
      findJsonPaths(val, nextPath, hits)
    }
  }
  return hits
}

function matchesTerm(text, terms) {
  const lower = text.toLowerCase()
  return terms.some((term) => lower.includes(term))
}

const allFiles = walkJsonFiles(EXTRACTED_DATA)
console.log(`Scanning ${allFiles.length} JSON files under extracted-data/`)

const resultsByPool = new Map()
for (const poolKey of orphanPools) {
  resultsByPool.set(poolKey, [])
}

for (const file of allFiles) {
  let json
  try {
    json = JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    continue
  }

  const relFile = relative(EXTRACTED_DATA, file).replace(/\\/g, '/')
  const stringFields = findJsonPaths(json)

  for (const poolKey of orphanPools) {
    const terms = poolTerms.get(poolKey)
    for (const { path, value } of stringFields) {
      if (typeof value !== 'string' || value.length > 500) continue
      if (!matchesTerm(value, terms)) continue

      const existing = resultsByPool.get(poolKey)
      if (existing.some((r) => r.file === relFile && r.path === path)) continue

      existing.push({
        file: relFile,
        path,
        snippet: value.length > 120 ? `${value.slice(0, 120)}…` : value,
      })
    }
  }
}

console.log('\n=== Orphan pool reference report ===\n')

for (const poolKey of orphanPools.sort()) {
  const bps = (missionBlueprints[poolKey] || []).map((b) => b.name).join(', ')
  const hits = resultsByPool.get(poolKey) || []
  console.log(`\n## ${poolKey} (${bps})`)
  console.log(`   References: ${hits.length}`)

  if (hits.length === 0) {
    console.log('   (none found in extracted-data)')
    continue
  }

  const byFile = new Map()
  for (const hit of hits) {
    if (!byFile.has(hit.file)) byFile.set(hit.file, [])
    byFile.get(hit.file).push(hit)
  }

  for (const [file, fileHits] of [...byFile.entries()].slice(0, 8)) {
    console.log(`   - ${file}`)
    for (const hit of fileHits.slice(0, 3)) {
      console.log(`       ${hit.path}: ${hit.snippet}`)
    }
    if (fileHits.length > 3) {
      console.log(`       … and ${fileHits.length - 3} more fields in this file`)
    }
  }
  if (byFile.size > 8) {
    console.log(`   … and ${byFile.size - 8} more files`)
  }
}

const poolsWithRefs = orphanPools.filter((k) => (resultsByPool.get(k) || []).length > 0)
const poolsWithoutRefs = orphanPools.filter((k) => (resultsByPool.get(k) || []).length === 0)

console.log('\n=== Summary ===')
console.log(`Pools with extracted-data references: ${poolsWithRefs.length}`)
console.log(`Pools with no references: ${poolsWithoutRefs.length}`)
if (poolsWithoutRefs.length) {
  console.log(`No-ref pools: ${poolsWithoutRefs.join(', ')}`)
}
