package discover

import (
	"os"
	"path/filepath"
	"strings"
)

const (
	DefaultWinPath = `C:\Program Files\Roberts Space Industries\StarCitizen`
	ScanMaxDepth   = 4
)

var (
	scanSkipDirs = map[string]struct{}{
		"windows": {}, "windows.old": {}, "winsxs": {},
		"$recycle.bin": {}, "$winreagent": {}, "$sysreset": {}, "$getcurrent": {},
		"system volume information": {}, "config.msi": {}, "recovery": {}, "boot": {},
		"programdata": {}, "appdata": {},
		"perflogs": {}, "onedrivetemp": {},
		"node_modules": {}, ".git": {}, ".svn": {}, ".hg": {},
	}
	scRootNames = map[string]struct{}{
		"starcitizen": {}, "star citizen": {},
	}
	knownChannels = map[string]struct{}{
		"LIVE": {}, "PTU": {}, "EPTU": {}, "HOTFIX": {}, "TECH-PREVIEW": {},
	}
)

func IsChannelDir(p string) bool {
	name := strings.ToUpper(filepath.Base(p))
	if _, ok := knownChannels[name]; ok {
		return true
	}
	fi, err := os.Stat(filepath.Join(p, "build_manifest.id"))
	return err == nil && !fi.IsDir()
}

func looksLikeSCRoot(p string) bool {
	entries, err := os.ReadDir(p)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if e.IsDir() && IsChannelDir(filepath.Join(p, e.Name())) {
			return true
		}
	}
	return false
}

type queueItem struct {
	path  string
	depth int
}

func findSCRoots(driveRoot string, maxDepth int) []string {
	var roots []string
	q := []queueItem{{driveRoot, 0}}
	for len(q) > 0 {
		cur := q[0]
		q = q[1:]
		entries, err := os.ReadDir(cur.path)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			nameLower := strings.ToLower(e.Name())
			if _, skip := scanSkipDirs[nameLower]; skip {
				continue
			}
			full := filepath.Join(cur.path, e.Name())
			if _, ok := scRootNames[nameLower]; ok && looksLikeSCRoot(full) {
				roots = append(roots, full)
				continue
			}
			if cur.depth+1 < maxDepth {
				q = append(q, queueItem{full, cur.depth + 1})
			}
		}
	}
	return roots
}

// DetectSCInstalls returns channel name → channel directory.
// Windows scans fixed drives; Linux/macOS scan Wine/Proton prefixes and mounts.
// When a channel shows up more than once (several prefixes), the one with the
// most recently written Game.log wins.
func DetectSCInstalls() map[string]string {
	found := map[string]string{}
	for _, root := range scanRoots() {
		for _, scRoot := range findSCRoots(root, ScanMaxDepth) {
			entries, err := os.ReadDir(scRoot)
			if err != nil {
				continue
			}
			for _, e := range entries {
				if !e.IsDir() {
					continue
				}
				channelDir := filepath.Join(scRoot, e.Name())
				if !IsChannelDir(channelDir) {
					continue
				}
				channel := strings.ToUpper(e.Name())
				if prev, exists := found[channel]; !exists || gameLogNewer(channelDir, prev) {
					found[channel] = channelDir
				}
			}
		}
	}
	return found
}

func gameLogNewer(a, b string) bool {
	ai, err := os.Stat(filepath.Join(a, "Game.log"))
	if err != nil {
		return false
	}
	bi, err := os.Stat(filepath.Join(b, "Game.log"))
	if err != nil {
		return true
	}
	return ai.ModTime().After(bi.ModTime())
}

func PreferLIVE(installs map[string]string) (channel, path string) {
	if p, ok := installs["LIVE"]; ok {
		return "LIVE", p
	}
	for k, v := range installs {
		return k, v
	}
	return "", ""
}

func FallbackLIVE() string {
	live := defaultLIVE()
	if live == "" {
		return ""
	}
	if fi, err := os.Stat(live); err == nil && fi.IsDir() {
		return live
	}
	return ""
}

// ValidateLogPath accepts a LIVE/channel folder or a Game.log / .log / .json file path.
func ValidateLogPath(userPath string) (channelOrFile string, errMsg string) {
	userPath = expandHome(strings.TrimSpace(strings.Trim(userPath, `"' `)))
	if userPath == "" {
		return "", "Path is required. Enter your Star Citizen LIVE folder (the folder that contains Game.log)."
	}
	fi, err := os.Stat(userPath)
	if err != nil {
		return "", "Path not found: " + userPath
	}
	if fi.IsDir() {
		gameLog := filepath.Join(userPath, "Game.log")
		if _, err := os.Stat(gameLog); err == nil {
			return userPath, ""
		}
		// Allow logbackups / channel dirs even if Game.log is not present yet
		if IsChannelDir(userPath) {
			return userPath, ""
		}
		return userPath, ""
	}
	return userPath, ""
}

// expandHome turns a leading ~/ into the user's home dir (shells do this, prompts don't).
func expandHome(p string) string {
	if p != "~" && !strings.HasPrefix(p, "~/") {
		return p
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return p
	}
	return filepath.Join(home, strings.TrimPrefix(p, "~"))
}
