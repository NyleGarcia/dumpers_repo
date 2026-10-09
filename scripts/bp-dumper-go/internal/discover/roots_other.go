//go:build !windows

package discover

import (
	"os"
	"path/filepath"
	"strings"
)

// ExampleLIVEPath is shown in prompts as a sample LIVE folder.
const ExampleLIVEPath = "~/Games/star-citizen/drive_c/Program Files/Roberts Space Industries/StarCitizen/LIVE"

// prefixScanDepth bounds the drive_c search under $HOME and mount points.
// ~/Games/Heroic/Prefixes/default/StarCitizen/drive_c sits at depth 5.
const prefixScanDepth = 6

// scanRoots returns Wine/Proton drive_c dirs, the extra Wine drives they map
// (dosdevices d:, e:, …) and mounted volumes. findSCRoots walks each one.
func scanRoots() []string {
	home, _ := os.UserHomeDir()
	var roots []string
	seen := map[string]struct{}{}
	add := func(p string) {
		if p == "" || !isDir(p) {
			return
		}
		key := p
		if r, err := filepath.EvalSymlinks(p); err == nil {
			key = r
		}
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		roots = append(roots, p)
	}
	addPrefix := func(prefix string) {
		add(filepath.Join(prefix, "drive_c"))
		for _, d := range wineDriveTargets(prefix) {
			add(d)
		}
	}

	if p := os.Getenv("WINEPREFIX"); p != "" {
		addPrefix(p)
	}
	if home != "" {
		for _, pattern := range knownPrefixGlobs(home) {
			matches, _ := filepath.Glob(pattern)
			for _, m := range matches {
				addPrefix(m)
			}
		}
	}
	for _, base := range prefixSearchBases(home) {
		for _, prefix := range findWinePrefixes(base, prefixScanDepth) {
			addPrefix(prefix)
		}
	}
	// Native volumes (e.g. /mnt/games/StarCitizen shared with a Windows install).
	for _, base := range mountBases() {
		add(base)
	}
	return roots
}

// knownPrefixGlobs lists the usual Lutris / Steam Proton / Bottles / Heroic prefixes.
func knownPrefixGlobs(home string) []string {
	return []string{
		filepath.Join(home, ".wine"),
		filepath.Join(home, "Games", "*"),
		filepath.Join(home, "Games", "Heroic", "Prefixes", "default", "*"),
		filepath.Join(home, ".local", "share", "Steam", "steamapps", "compatdata", "*", "pfx"),
		filepath.Join(home, ".steam", "steam", "steamapps", "compatdata", "*", "pfx"),
		filepath.Join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam", "steamapps", "compatdata", "*", "pfx"),
		filepath.Join(home, ".local", "share", "bottles", "bottles", "*"),
		filepath.Join(home, ".var", "app", "com.usebottles.bottles", "data", "bottles", "bottles", "*"),
		filepath.Join(home, ".var", "app", "net.lutris.Lutris", "data", "lutris", "prefixes", "*"),
	}
}

func prefixSearchBases(home string) []string {
	var bases []string
	if home != "" {
		bases = append(bases, home)
	}
	return append(bases, mountBases()...)
}

func mountBases() []string {
	var bases []string
	for _, pattern := range []string{"/mnt/*", "/media/*", "/media/*/*", "/run/media/*/*"} {
		matches, _ := filepath.Glob(pattern)
		for _, m := range matches {
			if isDir(m) {
				bases = append(bases, m)
			}
		}
	}
	return bases
}

// findWinePrefixes walks base breadth-first for dirs that contain drive_c.
// Hidden dirs are skipped (known hidden prefixes come from knownPrefixGlobs).
func findWinePrefixes(base string, maxDepth int) []string {
	var prefixes []string
	q := []queueItem{{base, 0}}
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
			name := e.Name()
			if name == "drive_c" {
				prefixes = append(prefixes, cur.path)
				break
			}
			if strings.HasPrefix(name, ".") {
				continue
			}
			if _, skip := scanSkipDirs[strings.ToLower(name)]; skip {
				continue
			}
			if cur.depth+1 < maxDepth {
				q = append(q, queueItem{filepath.Join(cur.path, name), cur.depth + 1})
			}
		}
	}
	return prefixes
}

// wineDriveTargets resolves prefix/dosdevices letters other than c: (drive_c)
// and z: (the whole host filesystem).
func wineDriveTargets(prefix string) []string {
	entries, err := os.ReadDir(filepath.Join(prefix, "dosdevices"))
	if err != nil {
		return nil
	}
	var out []string
	for _, e := range entries {
		name := strings.ToLower(e.Name())
		if len(name) != 2 || name[1] != ':' || name == "c:" || name == "z:" {
			continue
		}
		target, err := filepath.EvalSymlinks(filepath.Join(prefix, "dosdevices", e.Name()))
		if err != nil || target == "/" {
			continue
		}
		out = append(out, target)
	}
	return out
}

func defaultLIVE() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, "Games", "star-citizen", "drive_c", "Program Files", "Roberts Space Industries", "StarCitizen", "LIVE")
}

func isDir(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && fi.IsDir()
}
