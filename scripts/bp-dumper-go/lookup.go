package main

import (
	_ "embed"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

//go:embed lookup.json
var lookupJSON []byte

var (
	componentPrefixPattern = regexp.MustCompile(`(?i)^(?:civ|ind|mil|ste|com)/([0-9])/[a-d]\s+`)
	displayQuoteSuffix     = regexp.MustCompile(`\s+'[^']+'\s*$`)
	abbreviatedS00Pattern  = regexp.MustCompile(`(?i)^s00\s+(.+)$`)
	abbreviatedSizePattern = regexp.MustCompile(`(?i)^s(\d+)\s+(.+)$`)
)

// StarStrings display aliases → canonical lookup display keys.
var starStringsDisplayAliases = map[string]string{
	"lawson mining laser": "klein-sv mining laser",
	"pitman mining laser": "mining laser drak golem s1",
}

// StarStrings abbreviated mining laser product names → internal name prefix.
var abbreviatedMiningPrefixes = map[string]string{
	"helix":    "mining_laser_thcn_helix",
	"hofstede": "mining_laser_shin_hofstede",
	"klein":    "mining_laser_shin_klein",
	"lawson":   "mining_laser_shin_klein",
	"pitman":   "mining_laser_drak_golem",
	"golem":    "mining_laser_drak_golem",
}

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
	val = componentPrefixPattern.ReplaceAllString(val, "")
	val = displayQuoteSuffix.ReplaceAllString(val, "")
	return strings.TrimSpace(val)
}

func normalizeInternalKey(input string) string {
	normalized := strings.ToLower(strings.TrimSpace(strings.ReplaceAll(input, "\\", "/")))
	if strings.HasSuffix(normalized, ",p") {
		normalized = normalized[:len(normalized)-2]
	}
	normalized = strings.TrimPrefix(normalized, "bp_craft_")
	if strings.HasSuffix(normalized, "_scitem.json") {
		normalized = strings.TrimSuffix(normalized, "_scitem.json")
	} else if strings.HasSuffix(normalized, ".json") {
		normalized = strings.TrimSuffix(normalized, ".json")
	} else if strings.HasSuffix(normalized, "_scitem") {
		normalized = strings.TrimSuffix(normalized, "_scitem")
	}
	return normalized
}

func canonicalInternalKey(input string) string {
	return strings.TrimPrefix(normalizeInternalKey(input), "scitem_")
}

func resolveFromInternalKey(data *lookupMeta, internalKey string) (resolveResult, bool) {
	entry, ok := data.ByInternalName[internalKey]
	if !ok {
		return resolveResult{}, false
	}
	return resolveResult{
		OK:            true,
		InternalName:  internalKey,
		BlueprintName: entry.BlueprintName,
	}, true
}

func resolveFromDisplayKey(data *lookupMeta, displayKey string) (resolveResult, bool) {
	rawDisplay, ok := data.ByDisplayName[displayKey]
	if !ok {
		return resolveResult{}, false
	}

	var unique lookupUniqueDisplay
	if err := json.Unmarshal(rawDisplay, &unique); err == nil && unique.InternalName != "" {
		return resolveResult{
			OK:            true,
			InternalName:  unique.InternalName,
			BlueprintName: unique.BlueprintName,
		}, true
	}
	return resolveResult{}, false
}

func tryAbbreviatedMiningLaserResolve(data *lookupMeta, input string) (resolveResult, bool) {
	var size int
	var product string

	if m := abbreviatedS00Pattern.FindStringSubmatch(input); len(m) == 2 {
		size = 0
		product = strings.ToLower(strings.TrimSpace(m[1]))
	} else if m := abbreviatedSizePattern.FindStringSubmatch(input); len(m) == 3 {
		parsedSize, err := strconv.Atoi(m[1])
		if err != nil {
			return resolveResult{}, false
		}
		size = parsedSize
		product = strings.ToLower(strings.TrimSpace(m[2]))
	} else {
		return resolveResult{}, false
	}

	prefix, ok := abbreviatedMiningPrefixes[product]
	if !ok {
		return resolveResult{}, false
	}

	internalKey := prefix + "_s" + strconv.Itoa(size)
	return resolveFromInternalKey(data, internalKey)
}

func tryStarStringsDisplayAlias(data *lookupMeta, input string) (resolveResult, bool) {
	aliasKey, ok := starStringsDisplayAliases[normalizeDisplayKey(input)]
	if !ok {
		return resolveResult{}, false
	}
	return resolveFromDisplayKey(data, aliasKey)
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

	internalKey := canonicalInternalKey(input)
	if resolved, ok := resolveFromInternalKey(data, internalKey); ok {
		return resolved
	}

	rawDisplay, ok := data.ByDisplayName[normalizeDisplayKey(input)]
	if !ok {
		if resolved, ok := tryStarStringsDisplayAlias(data, input); ok {
			return resolved
		}
		if resolved, ok := tryAbbreviatedMiningLaserResolve(data, strings.TrimSpace(input)); ok {
			return resolved
		}
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
	prefixMatches := componentPrefixPattern.FindStringSubmatch(input)
	if len(prefixMatches) == 2 {
		sizeDigit := prefixMatches[1]
		filtered := make([]lookupCandidate, 0)
		for _, c := range candidates {
			if c.CategoryName != nil && strings.Contains(*c.CategoryName, "S"+sizeDigit) {
				filtered = append(filtered, c)
			}
		}
		if len(filtered) > 0 {
			candidates = filtered
		}
	}

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
		if key == "" {
			continue
		}

		validCandidates := make([]lookupCandidate, 0, len(internalNames))
		for _, rawInternal := range internalNames {
			internalName := canonicalInternalKey(rawInternal)
			entry, ok := data.ByInternalName[internalName]
			if !ok {
				continue
			}
			validCandidates = append(validCandidates, lookupCandidate{
				InternalName:  internalName,
				BlueprintName: entry.BlueprintName,
				CategoryName:  entry.CategoryName,
			})
		}
		if len(validCandidates) == 0 {
			continue
		}

		if len(validCandidates) == 1 {
			c := validCandidates[0]
			unique := lookupUniqueDisplay{
				InternalName:  c.InternalName,
				BlueprintName: c.BlueprintName,
			}
			raw, _ := json.Marshal(unique)
			data.ByDisplayName[key] = raw
		} else {
			ambiguous := lookupAmbiguousDisplay{
				Ambiguous:   true,
				DisplayName: localizedName,
				Candidates:  validCandidates,
			}
			raw, _ := json.Marshal(ambiguous)
			data.ByDisplayName[key] = raw
		}
	}
}
