#!/usr/bin/env node
/**
 * Regenerate blueprint-name-lookup.json from bundled catalog (no game extraction required).
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { buildBlueprintNameLookup, saveBlueprintNameLookup } from './lib/blueprintNameLookup.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const blueprints = JSON.parse(readFileSync(join(root, 'src/data/game-blueprints.json'), 'utf8'))
const missions = JSON.parse(readFileSync(join(root, 'src/data/game-blueprint-missions.json'), 'utf8'))

const lookup = buildBlueprintNameLookup(
  blueprints.blueprints ?? [],
  { contracts: missions.contracts ?? [] },
  missions.missionBlueprints ?? {}
)

saveBlueprintNameLookup(lookup, root)
