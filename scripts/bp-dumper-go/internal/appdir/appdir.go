package appdir

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// IsMsix reports Microsoft Store / MSIX packaging (WindowsApps or package family env).
func IsMsix() bool {
	if runtime.GOOS != "windows" {
		return false
	}
	if os.Getenv("PACKAGE_FAMILY_NAME") != "" || os.Getenv("MsixPackageFamilyName") != "" {
		return true
	}
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	resolved, err := filepath.EvalSymlinks(exe)
	if err == nil {
		exe = resolved
	}
	parts := strings.Split(strings.ToLower(exe), string(os.PathSeparator))
	for _, p := range parts {
		if p == "windowsapps" {
			return true
		}
	}
	return false
}

// Dir returns the directory that holds .env / .dumper_cache.json.
// Portable exe: beside the binary. Store/MSIX: %LOCALAPPDATA%\BP Dumper (WindowsApps is not writable).
// Linux/macOS binary in a read-only dir (e.g. /usr/local/bin): $XDG_CONFIG_HOME/bp-dumper.
func Dir() string {
	if IsMsix() {
		local := os.Getenv("LOCALAPPDATA")
		if local == "" {
			home, _ := os.UserHomeDir()
			local = filepath.Join(home, "AppData", "Local")
		}
		dir := filepath.Join(local, "BP Dumper")
		_ = os.MkdirAll(dir, 0o755)
		return dir
	}
	exe, err := os.Executable()
	if err != nil {
		wd, _ := os.Getwd()
		return wd
	}
	resolved, err := filepath.EvalSymlinks(exe)
	if err == nil {
		exe = resolved
	}
	dir := filepath.Dir(exe)
	if runtime.GOOS != "windows" && !writable(dir) {
		return userConfigDir()
	}
	return dir
}

func writable(dir string) bool {
	f, err := os.CreateTemp(dir, ".bp-dumper-write-test-*")
	if err != nil {
		return false
	}
	name := f.Name()
	_ = f.Close()
	_ = os.Remove(name)
	return true
}

func userConfigDir() string {
	base, err := os.UserConfigDir()
	if err != nil {
		wd, _ := os.Getwd()
		return wd
	}
	dir := filepath.Join(base, "bp-dumper")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}
