/**
 * Extract crafted-item base stats from entity SCItem JSON (health, power pips, etc.).
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
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

/** entityClass basename (lowercase) → absolute file path */
export function buildEntityClassPathIndex(extractedDataRoot) {
  const scitemDir = join(extractedDataRoot, 'libs/foundry/records/entities/scitem')
  const index = new Map()
  for (const file of walkJsonFiles(scitemDir)) {
    index.set(basename(file, '.json').toLowerCase(), file)
  }
  return index
}

/**
 * Map gameplay property keys used by crafting modifiers to entity base values.
 * @returns {Record<string, number> | null}
 */
export function extractEntityBaseStats(entityClass, entityPathIndex) {
  if (!entityClass || !entityPathIndex) return null

  const file = entityPathIndex.get(String(entityClass).toLowerCase())
  if (!file) return null

  const json = readJson(file)
  const components = json?._RecordValue_?.Components
  if (!Array.isArray(components)) return null

  const stats = {}

  for (const comp of components) {
    if (comp._Type_ === 'SHealthComponentParams' && comp.Health != null) {
      stats.Health_Maxhealth = comp.Health
    }

    if (comp._Type_ === 'ItemResourceComponentParams') {
      for (const state of comp.states ?? []) {
        for (const delta of state.deltas ?? []) {
          if (delta._Type_ !== 'ItemResourceDeltaGeneration') continue
          const amount = delta.generation?.resourceAmountPerSecond
          if (amount?._Type_ === 'SPowerSegmentResourceUnit' && amount.units != null) {
            stats.Itemresource_Powergeneration = amount.units
          }
        }
      }
    }

    if (comp._Type_ === 'WeaponComponentParams') {
      if (comp.damage?.damagePhysical != null) {
        stats.Weapon_Damage = comp.damage.damagePhysical
      }
      if (comp.damage?.damageEnergy != null && stats.Weapon_Damage == null) {
        stats.Weapon_Damage = comp.damage.damageEnergy
      }
    }

    if (comp._Type_ === 'SShieldComponentParams' && comp.MaxCapacity != null) {
      stats.Shield_Maxhealth = comp.MaxCapacity
    }
  }

  return Object.keys(stats).length > 0 ? stats : null
}
