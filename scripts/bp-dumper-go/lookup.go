package main

import (
	_ "embed"
	"encoding/json"
	"regexp"
	"strings"
)

//go:embed lookup.json
var lookupJSON []byte

var (
	bpCraftScitemPath      = regexp.MustCompile(`(?i)bp_craft_([^/]+?)_scitem\.json$`)
	bpCraftSimplePath      = regexp.MustCompile(`(?i)bp_craft_([^/]+?)\.json$`)
	componentPrefixPattern = regexp.MustCompile(`(?i)^(?:civ|ind|mil|ste|com)/[0-9]/[a-d]\s+`)
)

type lookupMeta struct {
	ByInternalName         map[string]lookupInternalEntry `json:"byInternalName"`
	ByDisplayName          map[string]json.RawMessage     `json:"byDisplayName"`
	ByContractDefinitionId map[string][]string            `json:"byContractDefinitionId"`
}

type lookupInternalEntry struct {
	BlueprintName string  `json:"blueprintName"`
	CategoryName  *string `json:"categoryName"`
}

type lookupUniqueDisplay struct {
	InternalName  string `json:"internalName"`
	BlueprintName string `json:"blueprintName"`
}

type lookupAmbiguousDisplay struct {
	Ambiguous   bool              `json:"ambiguous"`
	DisplayName string            `json:"displayName"`
	Candidates  []lookupCandidate `json:"candidates"`
}

type lookupCandidate struct {
	InternalName  string  `json:"internalName"`
	BlueprintName string  `json:"blueprintName"`
	CategoryName  *string `json:"categoryName"`
}

type resolveResult struct {
	OK            bool
	InternalName  string
	BlueprintName string
	Error         string // unknown_blueprint | ambiguous_blueprint
	DisplayName   string
}

var cachedLookup *lookupMeta

func loadLookup() (*lookupMeta, error) {
	if cachedLookup != nil {
		return cachedLookup, nil
	}
	var data lookupMeta
	if err := json.Unmarshal(lookupJSON, &data); err != nil {
		return nil, err
	}
	cachedLookup = &data
	return cachedLookup, nil
}

func normalizeDisplayKey(value string) string {
	val := strings.ToLower(strings.TrimSpace(value))
	return componentPrefixPattern.ReplaceAllString(val, "")
}

func normalizeInternalKey(input string) string {
	normalized := strings.ToLower(strings.TrimSpace(strings.ReplaceAll(input, "\\", "/")))
	if strings.HasSuffix(normalized, ",p") {
		normalized = normalized[:len(normalized)-2]
	}
	if m := bpCraftScitemPath.FindStringSubmatch(normalized); len(m) >= 2 {
		return m[1]
	}
	if m := bpCraftSimplePath.FindStringSubmatch(normalized); len(m) >= 2 {
		return m[1]
	}
	return normalized
}

// resolveBlueprintInput: internalName first, then display-name mapping, then contract disambiguation.
func resolveBlueprintInput(rawInput, contractDefinitionID string) resolveResult {
	data, err := loadLookup()
	if err != nil {
		return resolveResult{OK: false, Error: "unknown_blueprint", DisplayName: rawInput}
	}

	input := strings.TrimSpace(rawInput)
	if input == "" {
		return resolveResult{OK: false, Error: "unknown_blueprint"}
	}

	internalKey := normalizeInternalKey(input)
	if entry, ok := data.ByInternalName[internalKey]; ok {
		return resolveResult{
			OK:            true,
			InternalName:  internalKey,
			BlueprintName: entry.BlueprintName,
		}
	}

	rawDisplay, ok := data.ByDisplayName[normalizeDisplayKey(input)]
	if !ok {
		return resolveResult{OK: false, Error: "unknown_blueprint", DisplayName: input}
	}

	var unique lookupUniqueDisplay
	if err := json.Unmarshal(rawDisplay, &unique); err == nil && unique.InternalName != "" {
		return resolveResult{
			OK:            true,
			InternalName:  unique.InternalName,
			BlueprintName: unique.BlueprintName,
		}
	}

	var ambiguous lookupAmbiguousDisplay
	if err := json.Unmarshal(rawDisplay, &ambiguous); err != nil || !ambiguous.Ambiguous {
		return resolveResult{OK: false, Error: "unknown_blueprint", DisplayName: input}
	}

	candidates := ambiguous.Candidates
	contractKey := strings.ToLower(strings.TrimSpace(contractDefinitionID))
	if contractKey != "" {
		poolIDs := data.ByContractDefinitionId[contractKey]
		if len(poolIDs) > 0 {
			allowed := make(map[string]bool, len(poolIDs))
			for _, id := range poolIDs {
				allowed[id] = true
			}
			filtered := make([]lookupCandidate, 0)
			for _, c := range candidates {
				if allowed[c.InternalName] {
					filtered = append(filtered, c)
				}
			}
			if len(filtered) > 0 {
				candidates = filtered
			}
		}
	}

	if len(candidates) == 1 {
		return resolveResult{
			OK:            true,
			InternalName:  candidates[0].InternalName,
			BlueprintName: candidates[0].BlueprintName,
		}
	}

	displayName := ambiguous.DisplayName
	if displayName == "" {
		displayName = input
	}
	return resolveResult{
		OK:          false,
		Error:       "ambiguous_blueprint",
		DisplayName: displayName,
	}
}

// cacheKeyForInput returns the best local cache key for an acquired check (internal when known).
func cacheKeyForInput(rawInput string) string {
	resolved := resolveBlueprintInput(rawInput, "")
	if resolved.OK {
		return resolved.InternalName
	}
	return normalizeInternalKey(rawInput)
}

func registerCustomTranslations(translations map[string][]string) {
	data, err := loadLookup()
	if err != nil {
		return
	}
	for localizedName, internalNames := range translations {
		if len(internalNames) == 0 {
			continue
		}
		key := normalizeDisplayKey(localizedName)
		if len(internalNames) == 1 {
			internalName := internalNames[0]
			blueprintName := internalName
			if entry, ok := data.ByInternalName[internalName]; ok {
				blueprintName = entry.BlueprintName
			}
			unique := lookupUniqueDisplay{
				InternalName:  internalName,
				BlueprintName: blueprintName,
			}
			raw, _ := json.Marshal(unique)
			data.ByDisplayName[key] = raw
		} else {
			candidates := make([]lookupCandidate, len(internalNames))
			for i, internalName := range internalNames {
				blueprintName := internalName
				var cat *string
				if entry, ok := data.ByInternalName[internalName]; ok {
					blueprintName = entry.BlueprintName
					cat = entry.CategoryName
				}
				candidates[i] = lookupCandidate{
					InternalName:  internalName,
					BlueprintName: blueprintName,
					CategoryName:  cat,
				}
			}
			ambiguous := lookupAmbiguousDisplay{
				Ambiguous:   true,
				DisplayName: localizedName,
				Candidates:  candidates,
			}
			raw, _ := json.Marshal(ambiguous)
			data.ByDisplayName[key] = raw
		}
	}
}
