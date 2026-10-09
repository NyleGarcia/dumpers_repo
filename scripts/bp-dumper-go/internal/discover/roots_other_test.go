//go:build !windows

package discover

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func mkLIVE(t *testing.T, prefix string, mtime time.Time) string {
	t.Helper()
	live := filepath.Join(prefix, "drive_c", "Program Files", "Roberts Space Industries", "StarCitizen", "LIVE")
	if err := os.MkdirAll(live, 0o755); err != nil {
		t.Fatal(err)
	}
	log := filepath.Join(live, "Game.log")
	if err := os.WriteFile(log, []byte("<2026-10-09T00:00:00.000Z> test\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(log, mtime, mtime); err != nil {
		t.Fatal(err)
	}
	return live
}

func TestDetectSCInstallsFindsWinePrefixes(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("WINEPREFIX", "")

	old := time.Now().Add(-48 * time.Hour)
	// Proton prefix (hidden dir → found via known globs) with an older Game.log.
	mkLIVE(t, filepath.Join(home, ".local", "share", "Steam", "steamapps", "compatdata", "123", "pfx"), old)
	// Lutris / LUG default prefix with the newest Game.log.
	lutris := mkLIVE(t, filepath.Join(home, "Games", "star-citizen"), time.Now())

	installs := DetectSCInstalls()
	ch, p := PreferLIVE(installs)
	if ch != "LIVE" || p != lutris {
		t.Fatalf("PreferLIVE = (%q, %q), want (LIVE, %q)", ch, p, lutris)
	}
	if got := FallbackLIVE(); got != lutris {
		t.Fatalf("FallbackLIVE() = %q, want %q", got, lutris)
	}
}

func TestDetectSCInstallsFindsCustomPrefixByScan(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("WINEPREFIX", "")

	live := mkLIVE(t, filepath.Join(home, "wine", "sc"), time.Now())
	ch, p := PreferLIVE(DetectSCInstalls())
	if ch != "LIVE" || p != live {
		t.Fatalf("PreferLIVE = (%q, %q), want (LIVE, %q)", ch, p, live)
	}
}

func TestValidateLogPathExpandsHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	live := mkLIVE(t, filepath.Join(home, "Games", "star-citizen"), time.Now())
	got, errMsg := ValidateLogPath("~/Games/star-citizen/drive_c/Program Files/Roberts Space Industries/StarCitizen/LIVE")
	if errMsg != "" || got != live {
		t.Fatalf("ValidateLogPath = (%q, %q), want (%q, \"\")", got, errMsg, live)
	}
}
