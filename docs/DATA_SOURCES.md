# Data Sources

This document describes the structured game data files used by Dumper's Repo and their origins.

## Primary Source: Star Citizen Game Files (Direct Extraction)

All blueprint, component, mining, ordnance, reputation, and Archive lore data comes from direct extraction of Star Citizen's game files using StarBreaker.

### Extraction Process

1. **Extract DataForge**: Run `.\scripts\extract-game-data.ps1`
   - Uses StarBreaker CLI to extract the DCB database and localization from `Data.p4k`
   - Outputs JSON files to `extracted-data/` (gitignored)

2. **Parse Extracted Data**: Run `node scripts/parse-extracted-data.mjs`
   - Parses extracted JSON files
   - Generates app data files in `src/data/`
   - Reports validation issues if game data structure changed

3. **Validate catalog** (optional): `npm run validate-blueprints`

### Generated Data Files

| File | Description | Source |
|------|-------------|--------|
| `game-blueprint-missions.json` | Mission → blueprint reward mappings | `crafting/blueprintrewards/` |
| `game-blueprints.json` | Blueprint definitions with crafting recipes (**app catalog**) | `crafting/blueprints/` |
| `game-mining.json` | Mineable elements and mining lasers | `mining/`, `entities/scitem/ships/weapons/` |
| `game-components.json` | Ship components (coolers, shields, etc.) | `entities/scitem/ships/` |
| `game-reputation.json` | Reputation standing thresholds | `reputation/standings/` |
| `game-lore.json` | Resource/item lore for Archive | Game localization (`global.ini`) |
| `dfp-commodity-bases.json` | Q0 commodity/salvage DFP bases (UEX-backed) | `fetch-commodity-dfp-bases.mjs` |
| `component-metadata.json` | Component wiki metadata (DFP engine build input) | Star Citizen Wiki API |
| `_extraction-validation.json` | Validation issues (if any) | Generated |

The app **only** loads blueprint craft data from `game-blueprints.json`. There is no separate `Blueprints.json` or sccrafter sync.

### Data Validation

The parser validates expected data paths exist. If the game data structure changes between patches, the parser will report which paths are missing in `_extraction-validation.json`.

---

## Source: UEX Corp API (Live Shop Data)

**API:** [https://uexcorp.space/api/documentation](https://uexcorp.space/api/documentation)

Crowdsourced live shop inventories and prices across all systems (Stanton, Pyro, Nyx).

### Usage

Super-admins sync shop data via the **DB Actions** modal, which calls the `sync-shop-data` Edge Function. This populates shop inventory tables and component price summaries used by DFP.

Commodity Q0 bases for Resource Tracker DFP pricing: `npm run fetch-commodity-bases` (monthly refresh recommended).

---

## Source: Star Citizen Wiki API

**API:** `https://api.star-citizen.wiki/api/`

Used for supplementary component metadata during DFP engine builds (`component-metadata.json`). Archive lore comes from game localization, not this API.

---

## Source: seneca0815-rgb/SC_Signature_Scanner

**URL:** https://github.com/seneca0815-rgb/SC_Signature_Scanner

Mining RS signature reference data (`lookup.json`) used by the Mining Tracker.

---

## Extraction Scripts

Located in `/scripts/`:

| Script | Purpose |
|--------|---------|
| `extract-game-data.ps1` | Extract DataForge + localization from Data.p4k via StarBreaker |
| `parse-extracted-data.mjs` | Parse extracted JSON into `src/data/game-*.json` |
| `sync-game-data-to-db.mjs` | Optional: upsert mining/components/ordnance to Supabase `game_*` tables |
| `fetch-commodity-dfp-bases.mjs` | Refresh UEX-backed Q0 bases → `dfp-commodity-bases.json` |
| `validate-blueprints.mjs` | Sanity-check `game-blueprints.json` after parse |
| `verify-dfp-spotcheck.mjs` | Spot-check DFP engine output against catalog |
| `audit-blueprint-names.mjs` | Dev utility for catalog name audits |

---

## Data Update Process

When a new Star Citizen patch drops:

1. **Extract:** `.\scripts\extract-game-data.ps1`
2. **Parse:** `node scripts/parse-extracted-data.mjs`
3. **Validate:** `npm run validate-blueprints`
4. **Optional DB sync:** `node scripts/sync-game-data-to-db.mjs` (mining, components, ordnance → Supabase `game_*` tables)
5. **Optional DFP commodity bases:** `npm run fetch-commodity-bases` → rebuild DFP engine in `dfp-engine-private`
6. **Shop prices:** Super-admin **Sync Shop Data** in DB Actions (UEX Corp API via `sync-shop-data` Edge Function)
7. **Deploy:** Commit updated `game-*.json` (and DFP bundle if changed), `npm run build`, deploy `dist/`

If Step 2 reports validation issues in `_extraction-validation.json`, the game data structure may have changed.

---

## Removed Legacy Pipelines

These were removed from the repo and must not be reintroduced:

| Legacy source | Was replaced by |
|---------------|-----------------|
| sccrafter.com `Blueprints.json` + `sync-blueprints` | `game-blueprints.json` from game extraction |
| MrKraken StarStrings + `sync-starstrings` | `parse-extracted-data.mjs` + `game_*` DB tables |
| Separate `blueprint-acquisition.json` | `rewardMissions` on entries in `game-blueprints.json` |

---

## Type Definitions

All data types are defined in `src/data/index.ts` with helper functions for common queries:

```typescript
import {
  miningLocations,
  componentTypes,
  ordnance,
  contractBlueprints,
  getOreLocations,
  findComponents,
  findOrdnance,
  getBlueprintStanding
} from '@/data'
```
