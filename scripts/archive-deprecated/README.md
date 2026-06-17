# Deprecated Scripts

These scripts have been superseded by direct game file extraction.

## Why Deprecated

Previously, we depended on external sources:

**MrKraken's StarStrings** (community localization pack):
- Mining ore locations
- Component metadata  
- Ordnance data
- Blueprint-to-mission mappings

**Star Citizen Wiki API**:
- Resource lore/descriptions
- Mining laser stats
- FPS weapon stats
- Salvage module stats

This created dependencies on third parties updating their data after each patch.

## New Approach

We now extract ALL data directly from Star Citizen's game files using:

1. `extract-game-data.ps1` - Uses StarBreaker to extract DataForge + localization from Data.p4k
2. `parse-extracted-data.mjs` - Parses extracted JSON into app data files

This gives us:
- Zero external dependencies (besides the game itself)
- Faster updates (you control when to extract)
- More complete data (direct from source)
- Lore descriptions from game localization files
- Validation when game data structures change

## Archived Scripts

### StarStrings-based (replaced by direct extraction):
- `extract-starstrings-all.mjs` - Extracted data from StarStrings .ini files
- `enrich-from-starstrings.mjs` - Enriched blueprint data with StarStrings info
- `enrich-blueprint-acquisition.mjs` - Added blueprint acquisition data

### Wiki API-based (replaced by game file extraction):
- `fetch-resource-lore.mjs` - Fetched lore descriptions from star-citizen.wiki
- `enrich-mining-lasers.mjs` - Fetched mining laser stats from wiki
- `enrich-fps-weapons.mjs` - Fetched FPS weapon stats from wiki
- `enrich-salvage-modules.mjs` - Fetched salvage module stats from wiki

### scunpacked-based:
- `enrich-missions-scunpacked.mjs` - Cross-referenced mission data
