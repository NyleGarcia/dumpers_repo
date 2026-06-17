# Data Sources

This document describes the structured game data files used by Dumper's Repo and their origins.

## Primary Source: Star Citizen Game Files (Direct Extraction)

The primary data source is now direct extraction from Star Citizen's game files using StarBreaker.

### Extraction Process

1. **Extract DataForge**: Run `.\scripts\extract-game-data.ps1`
   - Uses StarBreaker CLI to extract the DCB database from `Data.p4k`
   - Outputs JSON files to `extracted-data/` (gitignored)

2. **Parse Extracted Data**: Run `node scripts/parse-extracted-data.mjs`
   - Parses extracted JSON files
   - Generates app data files in `src/data/`
   - Reports validation issues if game data structure changed

### Generated Data Files

| File | Description | Source |
|------|-------------|--------|
| `game-blueprint-missions.json` | Mission → blueprint reward mappings | `crafting/blueprintrewards/` |
| `game-blueprints.json` | Blueprint definitions with crafting recipes | `crafting/blueprints/` |
| `game-mining.json` | Mineable elements and mining lasers | `mining/`, `entities/scitem/ships/weapons/` |
| `game-components.json` | Ship components (coolers, shields, etc.) | `entities/scitem/ships/` |
| `game-reputation.json` | Reputation standing thresholds | `reputation/standings/` |
| `_extraction-validation.json` | Validation issues (if any) | Generated |

### Data Validation

The parser validates expected data paths exist. If the game data structure changes between patches, the parser will report which paths are missing in `_extraction-validation.json`.

---

## Deprecated: MrKraken's StarStrings

> **Note:** StarStrings extraction has been deprecated in favor of direct game file extraction.
> Old scripts are archived in `scripts/archive-deprecated/`.

StarStrings was a community-curated localization pack that added useful information to in-game text.
We previously extracted data from it, but this created a dependency on a third party updating their repo.

---

## Source: sccrafter.com

**Data URL:** `https://www.sccrafter.com/Blueprints.json`

The primary source for the complete crafting blueprint database, extracted from Star Citizen's game files.

### Data Provided

| Data | Description |
|------|-------------|
| Blueprint Catalog | Complete list of all craftable items |
| Crafting Slots | Resource/component requirements per blueprint |
| Mission Rewards | Which missions reward which blueprints |
| Drop Chances | Probability of blueprint drops |
| Locations | Where missions/blueprints are available |

### Sync Method

Super-admins can sync this data via the **DB Actions** modal in the app, which calls the `sync-blueprints` Edge Function.

Alternatively, the data can be fetched locally via:
```bash
npm run fetch-blueprints
```

---

## Source: Star Citizen Wiki API

**API:** `https://api.star-citizen.wiki/api/`

Used for fetching supplementary game data including component metadata.

### Data Files

| File | Description | Endpoint |
|------|-------------|----------|
| `component-metadata.json` | Component wiki metadata | `/api/components` |

---

## Source: scunpacked-data

**Repository:** [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data)

Raw extracted game data from Star Citizen data files.

### Usage

Used by `scripts/enrich-missions-scunpacked.mjs` to cross-reference mission reputation requirements.

---

## Extraction Scripts

Located in `/scripts/`:

| Script | Purpose |
|--------|---------|
| `extract-starstrings-all.mjs` | Master extraction from StarStrings |
| `enrich-missions-scunpacked.mjs` | Cross-reference missions with scunpacked-data |
| `enrich-from-starstrings.mjs` | Enrich blueprint acquisition data |
| `infer-mission-rep.mjs` | Infer missing rep requirements |

---

## Data Update Process

1. **Get latest StarStrings:** Download from MrKraken's repo
2. **Run extraction:** `node scripts/extract-starstrings-all.mjs`
3. **Run enrichment:** `node scripts/enrich-from-starstrings.mjs`
4. **Verify data:** Check generated JSON files
5. **Commit changes:** Push to repo

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

---

## Future Data Sources

Planned integrations:
- **Trade data:** Commodity prices and trade routes
- **Ship specs:** Detailed ship statistics
- **Location data:** POIs, landing zones, stations
